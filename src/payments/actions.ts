"use server";

// Every export here is a public HTTP endpoint. Export only guardedAction
// results; helpers live in queries.ts, schemas.ts and describe.ts.
import { eq } from "drizzle-orm";
import { z } from "zod";
import { guardedAction } from "@/auth/guarded-action";
import { getDb } from "@/db/client";
import { paymentVoids, payments } from "@/db/schema";
import { withUserContext, type UserTransaction } from "@/db/user-context";
import { todayAtGym } from "@/lib/dates";
import { describeRecordedPayment } from "@/payments/describe";
import { ledgerInTransaction } from "@/payments/queries";
import { paymentDetails, period, voidReason } from "@/payments/schemas";

export const recordPayment = guardedAction({
  permission: "payments.record",
  input: z.object({
    memberId: z.uuid(),
    membershipId: z.uuid(),
    firstPeriod: period,
    ...paymentDetails,
  }),
  run: async (input, viewer) => {
    const today = todayAtGym();
    const message = await withUserContext(
      getDb(),
      viewer.userId,
      async (tx) => {
        const [row] = await tx
          .insert(payments)
          .values({
            memberId: input.memberId,
            membershipId: input.membershipId,
            firstPeriod: input.firstPeriod,
            amountPaise: input.amount,
            method: input.method,
            paidOn: input.paidOn,
            receiptNumber: input.receiptNumber,
            note: input.note,
            recordedBy: viewer.userId,
          })
          .returning({ id: payments.id });
        const { ledger } = await ledgerInTransaction(
          tx,
          input.membershipId,
          today,
        );
        return describeRecordedPayment(ledger, row.id, input.amount);
      },
    );
    return { message };
  },
});

async function loadOriginal(tx: UserTransaction, paymentId: string) {
  const [original] = await tx
    .select({
      memberId: payments.memberId,
      membershipId: payments.membershipId,
      firstPeriod: payments.firstPeriod,
    })
    .from(payments)
    .where(eq(payments.id, paymentId));
  if (!original) throw new PaymentNotFoundError();
  return original;
}

// Payments are never edited or deleted (brief §4.4). Voiding keeps the row
// and the database records who voided it, when and why.
export const voidPayment = guardedAction({
  permission: "payments.void",
  input: z.object({ paymentId: z.uuid(), reason: voidReason }),
  run: async ({ paymentId, reason }, viewer) => {
    await withUserContext(getDb(), viewer.userId, async (tx) => {
      // Refuses a payment that doesn't exist (or isn't visible) by name.
      await loadOriginal(tx, paymentId);
      await tx
        .insert(paymentVoids)
        .values({ paymentId, reason, voidedBy: viewer.userId });
    });
    return { message: "Voided. It no longer counts towards any month." };
  },
});

// A correction is a new entry that voids the old one, in one transaction.
// It keeps the original's starting period; to move a payment to another
// month, void it and record it again.
export const correctPayment = guardedAction({
  permission: "payments.void",
  input: z.object({
    paymentId: z.uuid(),
    reason: voidReason,
    ...paymentDetails,
  }),
  run: async ({ paymentId, reason, ...details }, viewer) => {
    await withUserContext(getDb(), viewer.userId, async (tx) => {
      const original = await loadOriginal(tx, paymentId);
      await tx
        .insert(paymentVoids)
        .values({ paymentId, reason, voidedBy: viewer.userId });
      await tx.insert(payments).values({
        ...original,
        amountPaise: details.amount,
        method: details.method,
        paidOn: details.paidOn,
        receiptNumber: details.receiptNumber,
        note: details.note,
        replacesPaymentId: paymentId,
        recordedBy: viewer.userId,
      });
    });
    return { message: "Corrected. The old entry is voided and kept." };
  },
});

class PaymentNotFoundError extends Error {
  code = "P0002";
  constructor() {
    super("That payment no longer exists.");
  }
}
