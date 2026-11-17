// Browser versions of src/payments/actions.ts.
import { z } from "zod";
import { todayAtGym } from "@/lib/dates";
import { describeRecordedPayment } from "@/payments/describe";
import {
  duesFrom,
  paymentDetails,
  period,
  voidReason,
} from "@/payments/schemas";
import { dataOf, Refusal } from "../data/action";
import { rpc, table } from "../data/db";
import { ledgerFor, moveDueDate } from "../data/due-dates";
import { guardedAction } from "../data/guarded";

export const recordPayment = guardedAction({
  permission: "payments.record",
  input: z.object({
    memberId: z.uuid(),
    membershipId: z.uuid(),
    firstPeriod: period,
    ...paymentDetails,
    duesFrom,
  }),
  run: async (input) => {
    const today = todayAtGym();
    // First payment only: dues start on the day staff picked. The database
    // refuses it if a payment already counts.
    const dueChanges = input.duesFrom
      ? (
          await moveDueDate(input.membershipId, input.duesFrom, today, {
            firstPayment: true,
          })
        ).changes
      : null;
    const paymentId = await rpc<string>("record_payment", {
      member_id: input.memberId,
      membership_id: input.membershipId,
      first_period: input.firstPeriod,
      amount_paise: input.amount,
      method: input.method,
      paid_on: input.paidOn,
      receipt_number: input.receiptNumber,
      note: input.note,
      new_due_changes: dueChanges,
    });
    const { ledger } = await ledgerFor(input.membershipId, today);
    return {
      message: describeRecordedPayment(ledger, paymentId, input.amount),
    };
  },
});

export const voidPayment = guardedAction({
  permission: "payments.void",
  input: z.object({ paymentId: z.uuid(), reason: voidReason }),
  run: async ({ paymentId, reason }, viewer) => {
    const found = dataOf(
      await table("payments").select("id").eq("id", paymentId).maybeSingle(),
    );
    if (!found) throw new Refusal("That payment no longer exists.");
    dataOf(
      await table("payment_voids").insert({
        payment_id: paymentId,
        reason,
        voided_by: viewer.userId,
      }),
    );
    return { message: "Voided. It no longer counts towards any month." };
  },
});

export const correctPayment = guardedAction({
  permission: "payments.void",
  input: z.object({
    paymentId: z.uuid(),
    reason: voidReason,
    ...paymentDetails,
  }),
  run: async ({ paymentId, reason, ...details }) => {
    await rpc("correct_payment", {
      target_payment: paymentId,
      reason,
      amount_paise: details.amount,
      method: details.method,
      paid_on: details.paidOn,
      receipt_number: details.receiptNumber,
      note: details.note,
    });
    return { message: "Corrected. The old entry is voided and kept." };
  },
});
