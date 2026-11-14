// Typed mirror of the tables created in supabase/migrations. The SQL files are
// the source of truth (they hold the RLS policies, grants and triggers);
// schema.test.ts fails if this file drifts from them.
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Uint8Array }>({ dataType: () => "bytea" });

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

const currentUser = sql`auth.uid()`;

export const appRole = pgEnum("app_role", [
  "owner",
  "manager",
  "trainer",
  "member",
  "guest",
]);

export const paymentMethod = pgEnum("payment_method", ["cash", "upi", "other"]);

export const attendanceMethod = pgEnum("attendance_method", ["qr", "manual"]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name").notNull().default(""),
  email: text("email"),
  role: appRole("role").notNull().default("guest"),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const members = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberCode: text("member_code").notNull().unique(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  profileId: uuid("profile_id").references(() => profiles.id),
  reminderConsentAt: timestamp("reminder_consent_at", { withTimezone: true }),
  remindersMuted: boolean("reminders_muted").notNull().default(false),
  createdBy: uuid("created_by").default(currentUser),
  ...timestamps,
});

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  durationMonths: smallint("duration_months").notNull(),
  pricePaise: integer("price_paise").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id),
  startsOn: date("starts_on").notNull(),
  frozenFrom: date("frozen_from"),
  frozenUntil: date("frozen_until"),
  createdBy: uuid("created_by").default(currentUser),
  ...timestamps,
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id),
  amountPaise: integer("amount_paise").notNull(),
  method: paymentMethod("method").notNull(),
  paidOn: date("paid_on").notNull(),
  coversFrom: date("covers_from").notNull(),
  coversMonths: smallint("covers_months").notNull().default(1),
  receiptNumber: text("receipt_number"),
  slipPath: text("slip_path"),
  note: text("note"),
  replacesPaymentId: uuid("replaces_payment_id"),
  recordedBy: uuid("recorded_by").notNull().default(currentUser),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const paymentVoids = pgTable("payment_voids", {
  paymentId: uuid("payment_id")
    .primaryKey()
    .references(() => payments.id),
  reason: text("reason").notNull(),
  voidedBy: uuid("voided_by").notNull().default(currentUser),
  voidedAt: timestamp("voided_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const attendance = pgTable("attendance", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  gymDate: date("gym_date").notNull(),
  method: attendanceMethod("method").notNull(),
  markedBy: uuid("marked_by").default(currentUser),
});

export const claimTokens = pgTable("claim_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id),
  tokenHash: bytea("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedBy: uuid("used_by"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  occurredAt: timestamp("occurred_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  actorId: uuid("actor_id"),
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  action: text("action").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
});
