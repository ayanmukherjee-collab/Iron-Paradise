import { describe, expect, it } from "vitest";
import {
  emailText,
  reminderMessage,
  reminderSummary,
  whatsAppText,
} from "@/notifications/message";
import type { DueReminder } from "@/notifications/schedule";

const dueSoon: DueReminder = {
  stage: "due_soon",
  period: 2,
  dueOn: "2026-05-12",
  unpaidSince: "2026-05-12",
  amountPaise: 60000,
};

describe("reminder wording", () => {
  it("says when and how much", () => {
    expect(reminderMessage(dueSoon, "2026-05-09")).toEqual({
      title: "Gym fee due soon",
      body: "Your fee of ₹600 is due on 12 May 2026. Please pay at the front desk.",
    });
  });

  it("mentions older unpaid fees included in the amount", () => {
    const withDebt = {
      ...dueSoon,
      unpaidSince: "2026-04-12",
      amountPaise: 120000,
    };
    expect(reminderMessage(withDebt, "2026-05-09").body).toBe(
      "₹1,200 is due by 12 May 2026, including fees unpaid since 12 Apr 2026. Please pay at the front desk.",
    );
  });

  it("gives overdue reminders the date it was first due", () => {
    const overdue: DueReminder = { ...dueSoon, stage: "overdue" };
    expect(reminderMessage(overdue, "2026-05-15")).toEqual({
      title: "Gym fee overdue",
      body: "₹600 has been due since 12 May 2026. Please pay at the front desk.",
    });
    expect(reminderSummary(overdue)).toBe("₹600 · overdue since 12 May 2026");
  });

  it("greets members by first name on WhatsApp and gives their ID", () => {
    expect(
      whatsAppText({
        fullName: "Ravi Kumar",
        memberCode: "IP-0042",
        reminder: { ...dueSoon, stage: "due_today" },
        today: "2026-05-12",
      }),
    ).toBe(
      "Hi Ravi, this is Iron Paradise. Your fee of ₹600 is due today. Please pay at the front desk. Member ID: IP-0042. Thank you!",
    );
  });

  it("tells email readers why they get it and how to stop", () => {
    const { subject, text } = emailText({
      fullName: "Ravi Kumar",
      memberCode: "IP-0042",
      reminder: dueSoon,
      today: "2026-05-09",
      appUrl: "https://gym.example/app",
    });
    expect(subject).toBe("Gym fee due soon · Iron Paradise");
    expect(text).toContain("Hi Ravi,");
    expect(text).toContain("https://gym.example/app");
    expect(text).toMatch(/agreed to fee reminders/);
  });
});
