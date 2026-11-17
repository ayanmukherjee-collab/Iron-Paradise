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
  time,
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

export const reminderStage = pgEnum("reminder_stage", [
  "due_soon",
  "due_today",
  "overdue",
]);

export const notificationChannel = pgEnum("notification_channel", [
  "push",
  "email",
  "whatsapp",
]);

export const notificationStatus = pgEnum("notification_status", [
  "sending",
  "sent",
  "failed",
]);

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
  // Assigned by the database from member_code_seq (IP-0001, IP-0002, …).
  memberCode: text("member_code")
    .notNull()
    .unique()
    .default(
      sql`'IP-' || lpad(nextval('public.member_code_seq')::text, 4, '0')`,
    ),
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
  // A default that pre-fills new memberships; members pay their own agreed fee.
  defaultFeePaise: integer("default_fee_paise").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id),
  planId: uuid("plan_id").references(() => plans.id),
  startsOn: date("starts_on").notNull(),
  endedOn: date("ended_on"),
  // The first payment's day, which sets the monthly due day; null until the
  // first payment, meaning the joining day. Written only by database
  // triggers on payments and voids.
  billingStartsOn: date("billing_starts_on"),
  createdBy: uuid("created_by").default(currentUser),
  ...timestamps,
});

export const membershipFees = pgTable("membership_fees", {
  id: uuid("id").primaryKey().defaultRandom(),
  membershipId: uuid("membership_id")
    .notNull()
    .references(() => memberships.id),
  feePaise: integer("fee_paise").notNull(),
  effectiveFrom: date("effective_from").notNull(),
  note: text("note"),
  setBy: uuid("set_by").notNull().default(currentUser),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const membershipFreezes = pgTable("membership_freezes", {
  id: uuid("id").primaryKey().defaultRandom(),
  membershipId: uuid("membership_id")
    .notNull()
    .references(() => memberships.id),
  startsOn: date("starts_on").notNull(),
  // Last frozen day; null means frozen until further notice.
  endsOn: date("ends_on"),
  note: text("note"),
  createdBy: uuid("created_by").notNull().default(currentUser),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const gymSettings = pgTable("gym_settings", {
  id: boolean("id").primaryKey().default(true),
  goneQuietDays: smallint("gone_quiet_days").notNull().default(30),
  printedQrEnabled: boolean("printed_qr_enabled").notNull().default(true),
  // Gym-time "HH:MM:SS"; check-ins outside both batches are refused.
  morningOpens: time("morning_opens").notNull().default("05:00"),
  morningCloses: time("morning_closes").notNull().default("11:00"),
  eveningOpens: time("evening_opens").notNull().default("16:00"),
  eveningCloses: time("evening_closes").notNull().default("22:00"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id),
  // Always the same member as memberId; a composite foreign key enforces it.
  membershipId: uuid("membership_id")
    .notNull()
    .references(() => memberships.id),
  // The first period this payment pays towards (0 = due on the joining day).
  // Money beyond that period's fee flows on to the next (brief §4.4).
  firstPeriod: smallint("first_period").notNull(),
  amountPaise: integer("amount_paise").notNull(),
  method: paymentMethod("method").notNull(),
  paidOn: date("paid_on").notNull(),
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
  // Filled in by the database: the gym's local day (Asia/Kolkata).
  gymDate: date("gym_date")
    .notNull()
    .default(sql`(now() at time zone 'Asia/Kolkata')::date`),
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

export const deskDisplays = pgTable("desk_displays", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
  tokenHash: bytea("token_hash").notNull(),
  createdBy: uuid("created_by").notNull().default(currentUser),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id),
  // Always the same member as memberId; a composite foreign key enforces it.
  membershipId: uuid("membership_id")
    .notNull()
    .references(() => memberships.id),
  period: smallint("period").notNull(),
  stage: reminderStage("stage").notNull(),
  channel: notificationChannel("channel").notNull(),
  status: notificationStatus("status").notNull().default("sending"),
  dueOn: date("due_on").notNull(),
  amountPaise: integer("amount_paise").notNull(),
  error: text("error"),
  // Null when the daily job sent it.
  sentBy: uuid("sent_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
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
