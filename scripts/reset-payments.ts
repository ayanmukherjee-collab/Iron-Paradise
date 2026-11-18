// One-off: plan the switch to paying by months on the live database
// (supabase/migrations/*_pay_by_months.sql, private.reset_payments).
//
//   npx esbuild scripts/reset-payments.ts --bundle --platform=node --format=esm --outfile=<dir>/reset.mjs
//   node <dir>/reset.mjs <dir>
//
// Reads the memberships, fees, freezes and payments (read-only), works out
// each membership's new schedule with the old money rule (reset-plan.ts),
// and writes <dir>/reset.sql plus a summary. It changes nothing: applying
// reset.sql is a separate, deliberate step:
//   npx supabase db query --remote=<ref> --yes -f <dir>/reset.sql
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DueChangeRow } from "@/db/schema";
import type { IsoDate } from "@/lib/dates";
import type { MembershipWithFees } from "@/payments/ledger";
import {
  planReset,
  scheduleDifferences,
  type OldPayment,
  type ResetPlan,
} from "@/payments/reset-plan";

const project = "lttffxniaxxbstiaxvvz";
const outDir = process.argv[2];
if (!outDir) throw new Error("Pass the folder to write the plan to");
mkdirSync(outDir, { recursive: true });

const readSql = `
select json_build_object(
  'snapshot', now(),
  'memberships', (select coalesce(json_agg(json_build_object(
      'id', ms.id, 'startsOn', ms.starts_on, 'billingStartsOn', ms.billing_starts_on,
      'dueChanges', ms.due_changes, 'endedOn', ms.ended_on)), '[]'::json)
    from public.memberships ms),
  'fees', (select coalesce(json_agg(json_build_object(
      'membershipId', f.membership_id, 'feePaise', f.fee_paise,
      'effectiveFrom', f.effective_from, 'createdAt', f.created_at)), '[]'::json)
    from public.membership_fees f),
  'freezes', (select coalesce(json_agg(json_build_object(
      'membershipId', z.membership_id, 'startsOn', z.starts_on, 'endsOn', z.ends_on)), '[]'::json)
    from public.membership_freezes z),
  'payments', (select coalesce(json_agg(json_build_object(
      'membershipId', p.membership_id, 'firstPeriod', p.first_period,
      'amountPaise', p.amount_paise, 'createdAt', p.created_at,
      'voided', exists (select 1 from public.payment_voids v where v.payment_id = p.id))), '[]'::json)
    from public.payments p)
) as data;`;

interface Snapshot {
  snapshot: string;
  memberships: {
    id: string;
    startsOn: IsoDate;
    billingStartsOn: IsoDate | null;
    dueChanges: DueChangeRow[];
    endedOn: IsoDate | null;
  }[];
  fees: {
    membershipId: string;
    feePaise: number;
    effectiveFrom: IsoDate;
    createdAt: string;
  }[];
  freezes: {
    membershipId: string;
    startsOn: IsoDate;
    endsOn: IsoDate | null;
  }[];
  payments: {
    membershipId: string;
    firstPeriod: number;
    amountPaise: number;
    createdAt: string;
    voided: boolean;
  }[];
}

const readFile = join(outDir, "read.sql");
writeFileSync(readFile, readSql);
const raw = execFileSync(
  "npx",
  [
    "supabase",
    "db",
    "query",
    `--remote=${project}`,
    "--read-only",
    "--output-format",
    "json",
    "-f",
    JSON.stringify(readFile),
  ],
  { encoding: "utf8", shell: true, maxBuffer: 256 * 1024 * 1024 },
);
writeFileSync(join(outDir, "raw.json"), raw);
const data = findSnapshot(JSON.parse(raw));

const group = <T extends { membershipId: string }>(rows: T[]) => {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    map.set(row.membershipId, [...(map.get(row.membershipId) ?? []), row]);
  }
  return map;
};
const fees = group(data.fees);
const freezes = group(data.freezes);
const payments = group(data.payments);

const plans: ResetPlan[] = [];
const problems: string[] = [];
let paidUp = 0;
let owing = 0;
let partLost = 0;
let partLostPaise = 0;
for (const row of data.memberships) {
  const all = payments.get(row.id) ?? [];
  const counted: OldPayment[] = all
    .filter((p) => !p.voided)
    .map((p) => ({
      firstPeriod: p.firstPeriod,
      amountPaise: p.amountPaise,
      createdAt: new Date(p.createdAt),
    }));
  if (counted.length === 0) {
    // Nothing paid: the dues already run from the joining day (or where
    // staff moved them); the wipe changes nothing but must list it if it
    // ever had a payment.
    if (all.length || row.billingStartsOn) {
      plans.push({
        membershipId: row.id,
        shift: 0,
        dueChanges: row.dueChanges,
        droppedPartPaise: 0,
      });
    }
    continue;
  }
  const membership: MembershipWithFees = {
    startsOn: row.startsOn,
    billingStartsOn: row.billingStartsOn ?? row.startsOn,
    dueChanges: row.dueChanges.map((c) => ({
      fromPeriod: c.from_period,
      dueOn: c.due_on,
    })),
    endedOn: row.endedOn,
    freezes: (freezes.get(row.id) ?? []).map((f) => ({
      startsOn: f.startsOn,
      endsOn: f.endsOn,
    })),
    fees: (fees.get(row.id) ?? []).map((f) => ({
      feePaise: f.feePaise,
      effectiveFrom: f.effectiveFrom,
      createdAt: new Date(f.createdAt),
    })),
  };
  const plan = planReset(row.id, membership, counted);
  if (!plan) {
    problems.push(`${row.id}: no schedule fits`);
    continue;
  }
  const differ = scheduleDifferences(membership, plan);
  if (differ.length) {
    problems.push(`${row.id}: months ${differ.join(", ")} would move`);
  }
  plans.push(plan);
  const firstDue = plan.dueChanges[0]?.due_on;
  const today = new Date().toISOString().slice(0, 10);
  if (firstDue && firstDue < today) owing++;
  else paidUp++;
  if (plan.droppedPartPaise > 0) {
    partLost++;
    partLostPaise += plan.droppedPartPaise;
  }
}

const summary = {
  snapshot: data.snapshot,
  memberships: data.memberships.length,
  payments: data.payments.length,
  voided: data.payments.filter((p) => p.voided).length,
  plans: plans.length,
  paidUpOrAhead: paidUp,
  owing,
  partPaidMonthsDropped: partLost,
  partPaidRupeesDropped: partLostPaise / 100,
  problems,
};
writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
writeFileSync(join(outDir, "plans.json"), JSON.stringify(plans, null, 2));
const payload = plans.map(({ membershipId, shift, dueChanges }) => ({
  membershipId,
  shift,
  dueChanges,
}));
writeFileSync(
  join(outDir, "reset.sql"),
  `select private.reset_payments('${data.snapshot}'::timestamptz, '${JSON.stringify(payload).replaceAll("'", "''")}'::jsonb) as summary;\n`,
);
console.log(JSON.stringify(summary, null, 2));

/** The CLI wraps rows in an envelope; find the object holding `snapshot`. */
function findSnapshot(value: unknown): Snapshot {
  if (value && typeof value === "object") {
    if ("snapshot" in value && "memberships" in value) return value as Snapshot;
    if (
      "data" in value &&
      typeof (value as { data: unknown }).data === "string"
    ) {
      return JSON.parse((value as { data: string }).data) as Snapshot;
    }
    for (const child of Object.values(value)) {
      try {
        return findSnapshot(child);
      } catch {
        // keep looking
      }
    }
  }
  throw new Error("Couldn't find the snapshot in the query output");
}
