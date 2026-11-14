import { describe, expect, it } from "vitest";
import { mirrorOutline, smoothClosedPath, spikyHair } from "./silhouette";

describe("mirrorOutline", () => {
  it("reflects the right half across the axis without duplicating the axis point", () => {
    const outline = mirrorOutline(
      [
        [210, 0],
        [250, 50],
        [200, 100],
      ],
      200,
    );
    expect(outline).toEqual([
      [210, 0],
      [250, 50],
      [200, 100],
      [150, 50],
      [190, 0],
    ]);
  });
});

describe("smoothClosedPath", () => {
  it("emits one cubic segment per point and closes the path", () => {
    const d = smoothClosedPath([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]);
    expect(d.startsWith("M0 0")).toBe(true);
    expect(d.match(/C/g)).toHaveLength(4);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("refuses outlines too short to close", () => {
    expect(() =>
      smoothClosedPath([
        [0, 0],
        [1, 1],
      ]),
    ).toThrow();
  });
});

describe("spikyHair", () => {
  it("puts each spike tip further out than the valleys around it", () => {
    const d = spikyHair({
      center: [0, 0],
      valleyRadius: 10,
      rise: 0,
      spikes: [{ angle: 270, length: 20 }],
      hairline: [[0, 5]],
    });
    const points = d
      .replace(/[MZ]/g, "")
      .split("L")
      .map((pair) => pair.trim().split(" ").map(Number));
    const distances = points.map(([x, y]) => Math.hypot(x, y));
    expect(distances[1]).toBeCloseTo(30, 0);
    expect(distances[0]).toBeCloseTo(10, 0);
    expect(distances[2]).toBeCloseTo(10, 0);
  });
});
