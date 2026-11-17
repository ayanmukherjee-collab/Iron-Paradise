import { describe, expect, it } from "vitest";
import {
  crowdFile,
  crowdLevel,
  estimateCrowd,
  presenceWeight,
  readCrowd,
} from "@/bulletin/crowd";
import type { CrowdSettings } from "@/bulletin/types";

const settings: CrowdSettings = {
  comfortableCapacity: 40,
  calibrationMultiplier: 1,
  fullMinutes: 45,
  goneMinutes: 120,
};

const now = new Date("2026-11-17T12:30:00Z");

/** A check-in `minutes` before `now`, in crowd.json's format. */
function ago(minutes: number): string {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

describe("presenceWeight", () => {
  it("counts a check-in fully for its first 45 minutes", () => {
    expect(presenceWeight(0)).toBe(1);
    expect(presenceWeight(30)).toBe(1);
    expect(presenceWeight(45)).toBe(1);
  });

  it("fades out linearly until 120 minutes", () => {
    expect(presenceWeight(82.5)).toBeCloseTo(0.5);
    expect(presenceWeight(60)).toBeCloseTo(0.8);
    expect(presenceWeight(119)).toBeCloseTo(1 / 75);
  });

  it("stops counting at 120 minutes and after", () => {
    expect(presenceWeight(120)).toBe(0);
    expect(presenceWeight(500)).toBe(0);
  });

  it("ignores times in the future (a phone clock running slow)", () => {
    expect(presenceWeight(-1)).toBe(0);
  });

  it("follows the owner's windows", () => {
    expect(presenceWeight(30, 20, 60)).toBeCloseTo(0.75);
    expect(presenceWeight(60, 20, 60)).toBe(0);
  });
});

describe("estimateCrowd", () => {
  it("adds up what each check-in still counts", () => {
    expect(
      estimateCrowd([ago(5), ago(40), ago(82.5), ago(130)], settings, now),
    ).toBeCloseTo(2.5);
  });

  it("is zero with no check-ins", () => {
    expect(estimateCrowd([], settings, now)).toBe(0);
  });

  it("scales by the calibration multiplier", () => {
    expect(
      estimateCrowd(
        [ago(1), ago(2)],
        { ...settings, calibrationMultiplier: 1.5 },
        now,
      ),
    ).toBeCloseTo(3);
  });

  it("keeps fading as time passes with the same file", () => {
    const checkins = [ago(50)];
    const later = new Date(now.getTime() + 30 * 60_000);
    expect(estimateCrowd(checkins, settings, later)).toBeLessThan(
      estimateCrowd(checkins, settings, now),
    );
  });
});

describe("crowdLevel", () => {
  it("is Quiet under 30% of comfortable capacity", () => {
    expect(crowdLevel(0, 40)).toBe("Quiet");
    expect(crowdLevel(11.9, 40)).toBe("Quiet");
  });

  it("is Moderate from 30% to 70%", () => {
    expect(crowdLevel(12, 40)).toBe("Moderate");
    expect(crowdLevel(28, 40)).toBe("Moderate");
  });

  it("is Busy over 70%", () => {
    expect(crowdLevel(28.1, 40)).toBe("Busy");
    expect(crowdLevel(100, 40)).toBe("Busy");
  });
});

describe("readCrowd", () => {
  it("gives the level and a bar share capped at full", () => {
    const busy = Array.from({ length: 60 }, () => ago(10));
    expect(readCrowd(busy, settings, now)).toEqual({ level: "Busy", share: 1 });
    const some = Array.from({ length: 20 }, () => ago(10));
    expect(readCrowd(some, settings, now)).toEqual({
      level: "Moderate",
      share: 0.5,
    });
  });
});

describe("crowdFile", () => {
  it("accepts the file Postgres writes", () => {
    expect(
      crowdFile.safeParse({
        generatedAt: "2026-11-17T12:30:00Z",
        checkins: ["2026-11-17T12:29:00Z", "2026-11-17T11:02:00Z"],
      }).success,
    ).toBe(true);
  });

  it("refuses anything that isn't a list of times", () => {
    expect(
      crowdFile.safeParse({
        generatedAt: "2026-11-17T12:30:00Z",
        checkins: [{ name: "Alice", at: "2026-11-17T12:29:00Z" }],
      }).success,
    ).toBe(false);
  });
});
