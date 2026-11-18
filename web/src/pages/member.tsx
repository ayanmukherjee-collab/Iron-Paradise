// Mirrors src/app/app/members/[id]/page.tsx.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useParams } from "react-router";
import { VisitCharts } from "@/attendance/components/visit-charts";
import { roleLabels, type Role } from "@/auth/permissions";
import { memberAccountRoles } from "@/auth/roles";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { ActionForm } from "@/components/ui/action-form";
import { useAfterSave } from "@/components/ui/after-save";
import { BackLink } from "@/components/ui/back-link";
import { Dialog } from "@/components/ui/dialog";
import { Disclosure } from "@/components/ui/disclosure";
import { Checkbox, Field, inputClass } from "@/components/ui/field";
import Link from "@/components/ui/link";
import { Tabs, type Tab } from "@/components/ui/tabs";
import { gym } from "@/content/landing";
import {
  formatDate,
  formatDateTime,
  formatShortDate,
  todayAtGym,
} from "@/lib/dates";
import { formatPaise, paiseToInput } from "@/lib/money";
import { ClaimLinkPanel } from "@/members/components/claim-link-panel";
import { NewMembershipFields } from "@/members/components/new-membership-fields";
import { StatusBadge } from "@/members/components/status-badge";
import { formatMobile, whatsAppLink } from "@/members/phone";
import { PaymentHistory } from "@/payments/components/payment-history";
import { standingLabels } from "@/payments/describe";
import { markAttendance } from "../actions/attendance";
import {
  changeDueDate,
  changeFee,
  createClaimLink,
  deactivateMember,
  deleteMember,
  endFreeze,
  freezeMembership,
  reactivateMember,
  updateMember,
} from "../actions/members";
import { changeMemberRole } from "../actions/team";
import { useViewer, viewerCan, type Viewer } from "../auth/viewer";
import {
  getMemberDetail,
  listPlans,
  type MemberDetail,
  type Plan,
} from "../data/members";
import { getMemberPayments, type MemberPayments } from "../data/payments";
import { Loaded, useLoad, useTitle } from "../data/use-load";
import { NotFound } from "./not-found";

export function MemberPage() {
  const { id = "" } = useParams();
  const viewer = useViewer();
  useTitle("Member");
  const state = useLoad(async () => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const [detail, payments] = await Promise.all([
      getMemberDetail(viewer, id),
      viewerCan(viewer, "payments.viewSheet") ? getMemberPayments(id) : null,
    ]);
    if (!detail) return null;
    const plans =
      viewerCan(viewer, "members.edit") && detail.status === "inactive"
        ? await listPlans(true)
        : [];
    return { detail, payments, plans };
  }, [id, viewer.userId]);

  return (
    <Loaded state={state}>
      {(loaded) =>
        loaded ? <MemberView viewer={viewer} {...loaded} /> : <NotFound />
      }
    </Loaded>
  );
}

function MemberView({
  viewer,
  detail,
  payments,
  plans,
}: {
  viewer: Viewer;
  detail: MemberDetail;
  payments: MemberPayments | null;
  plans: Plan[];
}) {
  const { member, membership, status } = detail;
  const canEdit = viewerCan(viewer, "members.edit");
  const canEditMembership = viewerCan(viewer, "memberships.edit");
  const canLink = viewerCan(viewer, "guests.link");
  const canMark = viewerCan(viewer, "attendance.mark");
  const canRecord = viewerCan(viewer, "payments.record");
  const canChangeType = viewerCan(viewer, "roles.change");
  const canDelete = viewerCan(viewer, "members.delete");
  const today = todayAtGym();
  const inToday = detail.visits.some((visit) => visit.gymDate === today);
  const ledger = payments?.ledger ?? null;
  const owes = (ledger?.owedPaise ?? 0) > 0;
  const [actionsOpen, setActionsOpen] = useState(false);

  const actionTabs: Tab[] = [
    ...(canEdit
      ? [
          {
            id: "details",
            label: "Details",
            content: <DetailsForm detail={detail} />,
          },
        ]
      : []),
    ...(canEditMembership && membership
      ? [{ id: "fee", label: "Fee", content: <FeeForm detail={detail} /> }]
      : []),
    ...(canEditMembership && membership && payments
      ? [
          {
            id: "due",
            label: "Due",
            content: <DueDateForm detail={detail} dueOn={payments.dueToMove} />,
          },
        ]
      : []),
    ...(canEditMembership && membership
      ? [
          {
            id: "freeze",
            label: membership.activeFreeze ? "Unfreeze" : "Freeze",
            content: <FreezeControls detail={detail} today={today} />,
          },
        ]
      : []),
  ];
  const hasActions = actionTabs.length > 0 || canDelete;
  const showMarkIn = canMark && status !== "inactive" && !inToday;

  return (
    <article className="space-y-4">
      <header className="page-header">
        <BackLink href="/app/members" label="Members" className="mb-1" />
        <div className="flex items-center gap-3">
          <h1 className="min-w-0 flex-1 page-title break-words">
            {member.fullName}
          </h1>
          {hasActions && (
            <button
              type="button"
              onClick={() => setActionsOpen(true)}
              aria-label="Account actions"
              title="Account actions"
              className="flex size-11 shrink-0 items-center justify-center rounded-control bg-white text-ink shadow-card ring-1 ring-line transition-colors hover:bg-ink hover:text-white"
            >
              <NavIconSvg icon="gear" className="size-5" />
            </button>
          )}
        </div>
      </header>

      {/* Who they are and where they stand, at a glance. */}
      <section className="card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span className="font-mono text-ink">{member.memberCode}</span>
              <a
                href={whatsAppLink(
                  member.phone,
                  `Hi ${firstName(member.fullName)}, `,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-line underline-offset-4 hover:text-ink hover:decoration-ink"
              >
                {formatMobile(member.phone)}
              </a>
            </p>
            <p className="mt-1 truncate text-sm text-muted">
              {detail.accountEmail ??
                (member.profileId
                  ? "App account linked"
                  : "No app account yet")}
            </p>
          </div>
          <StatusBadge status={status} />
        </div>

        <dl
          className={`mt-5 grid gap-2 ${payments ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)]" : "grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"}`}
        >
          {payments && (
            <Stat
              label="Payment"
              dark={owes}
              value={
                owes
                  ? formatPaise(ledger!.owedPaise)
                  : ledger
                    ? standingLabels[ledger.standing]
                    : "—"
              }
              note={
                owes
                  ? "Owed"
                  : ledger?.nextUnpaid
                    ? `Next ${formatShortDate(ledger.nextUnpaid.dueOn, today)}`
                    : status === "frozen"
                      ? "On hold"
                      : undefined
              }
            />
          )}
          <Stat
            label="Membership"
            value={
              !membership
                ? "Ended"
                : membership.feePaise === null
                  ? (membership.planName ?? "Current")
                  : membership.feePaise === 0
                    ? "Free"
                    : formatPaise(membership.feePaise)
            }
            note={
              membership
                ? membership.feePaise
                  ? "A month"
                  : `Since ${formatShortDate(membership.startsOn, today)}`
                : undefined
            }
          />
          <TypeStat
            memberId={member.id}
            role={detail.accountRole}
            canChange={canChangeType && !!member.profileId}
          />
        </dl>

        {membership?.activeFreeze && (
          <p className="mt-3 callout text-sm">
            Frozen from {formatDate(membership.activeFreeze.startsOn)}
            {membership.activeFreeze.endsOn
              ? ` to ${formatDate(membership.activeFreeze.endsOn)}`
              : " →"}
          </p>
        )}
        {(ledger?.creditPaise ?? 0) > 0 && (
          <p className="mt-3 callout text-sm">
            {formatPaise(ledger!.creditPaise)} credit
          </p>
        )}

        {((canRecord && ledger) || showMarkIn) && (
          <div className="mt-4 flex gap-2">
            {canRecord && ledger && (
              <Link
                href={`/app/members/${member.id}/pay`}
                className="btn-dark flex-1 px-4 whitespace-nowrap sm:flex-none"
              >
                Record payment
              </Link>
            )}
            {showMarkIn && (
              <ActionForm
                action={markAttendance}
                submitLabel="Mark in today"
                pendingLabel="Marking…"
                variant="outline-dark"
                className="flex-1 sm:flex-none [&_button]:w-full [&_button]:px-4 [&_button]:whitespace-nowrap [&>div]:mt-0"
              >
                <input type="hidden" name="memberId" value={member.id} />
              </ActionForm>
            )}
          </div>
        )}
      </section>

      {!membership && canEdit && (
        <section className="card-section">
          <h2 className="section-title">Start a new membership</h2>
          <ActionForm
            action={reactivateMember}
            submitLabel="Reactivate"
            className="mt-5 max-w-lg space-y-4"
          >
            <input type="hidden" name="memberId" value={member.id} />
            <NewMembershipFields
              plans={plans.map(({ id, name, defaultFeePaise }) => ({
                id,
                name,
                defaultFeePaise,
              }))}
              today={today}
            />
          </ActionForm>
        </section>
      )}

      {canLink && !member.profileId && member.isActive && (
        <Disclosure
          title="Claim link"
          summary={claimStatusText(detail.claimLink)}
          icon="user"
        >
          <ClaimLinkPanel
            memberId={member.id}
            firstName={firstName(member.fullName)}
            phone={member.phone}
            gymName={gym.fullName}
            hasOpenLink={detail.claimLink.state === "open"}
            createClaimLink={createClaimLink}
          />
        </Disclosure>
      )}

      {payments && (
        <RecentPayments
          history={payments.history}
          canVoid={viewerCan(viewer, "payments.void")}
          today={today}
        />
      )}

      <VisitCharts
        visits={detail.visits.map((visit) => visit.gymDate)}
        today={today}
      />

      {detail.pastMemberships.length > 0 && (
        <Disclosure
          title="Past memberships"
          summary={`${detail.pastMemberships.length} earlier`}
          icon="clock"
        >
          <ul className="space-y-1 text-sm">
            {detail.pastMemberships.map((past) => (
              <li key={past.id}>
                {formatDate(past.startsOn)} to {formatDate(past.endedOn!)}
                {past.planName && (
                  <span className="text-muted"> · {past.planName}</span>
                )}
              </li>
            ))}
          </ul>
        </Disclosure>
      )}

      {hasActions && (
        <Dialog
          open={actionsOpen}
          onClose={() => setActionsOpen(false)}
          title="Account actions"
          headerExtra={canDelete && <DeleteButton detail={detail} />}
        >
          {actionTabs.length > 0 ? (
            <Tabs tabs={actionTabs} label="Account actions" />
          ) : (
            <p className="text-sm text-muted">
              Only deleting is open to you here.
            </p>
          )}
        </Dialog>
      )}
    </article>
  );
}

/** The latest three payments, with the rest a tap away. */
function RecentPayments({
  history,
  canVoid,
  today,
}: {
  history: MemberPayments["history"];
  canVoid: boolean;
  today: string;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? history : history.slice(0, 3);
  return (
    <section aria-label="Payments" className="card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold tracking-tight">
          <NavIconSvg icon="payments" className="size-5" />
          Payments
        </h2>
        {history.length > 3 && (
          <button
            type="button"
            onClick={() => setAll((value) => !value)}
            className="min-h-10 text-sm font-medium text-muted underline decoration-line underline-offset-4 hover:text-ink hover:decoration-ink"
          >
            {all ? "Show fewer" : `See all ${history.length}`}
          </button>
        )}
      </div>
      <div className="mt-4">
        <PaymentHistory history={shown} canVoid={canVoid} today={today} />
      </div>
    </section>
  );
}

/**
 * The app account's type, as one of the figures. Staff who may change it
 * tap the small triangle for a menu; picking a type saves it straight away.
 */
function TypeStat({
  memberId,
  role,
  canChange,
}: {
  memberId: string;
  role: Role | null;
  canChange: boolean;
}) {
  const afterSave = useAfterSave();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = async (next: Role) => {
    setOpen(false);
    if (next === role) return;
    setSaving(true);
    setError(null);
    const form = new FormData();
    form.set("memberId", memberId);
    form.set("role", next);
    const result = await changeMemberRole(form);
    setSaving(false);
    if (result.ok) afterSave(result.data);
    else setError(result.error);
  };

  const label = role ? roleLabels[role] : "—";
  return (
    <div ref={root} className="relative min-w-0 rounded-tile bg-canvas p-3">
      <dt className="text-xs text-muted">Type</dt>
      <dd className="mt-1">
        {canChange && role ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={`Type: ${label}. Change type`}
            disabled={saving}
            onClick={() => setOpen((value) => !value)}
            className="flex max-w-full items-center gap-1.5 text-base leading-7 font-semibold tracking-tight disabled:opacity-60"
          >
            <span className="truncate">{saving ? "Saving…" : label}</span>
            <svg
              viewBox="0 0 10 10"
              aria-hidden="true"
              className={`size-2.5 shrink-0 fill-current transition-transform duration-150 ${open ? "rotate-180" : ""}`}
            >
              <path d="M1 3h8L5 8.5z" />
            </svg>
          </button>
        ) : (
          <span className="block truncate text-base leading-7 font-semibold tracking-tight">
            {label}
          </span>
        )}
      </dd>
      <dd
        role={error ? "alert" : undefined}
        className="truncate text-xs text-muted"
        title={error ?? undefined}
      >
        {error ?? (role ? "Account" : "No account")}
      </dd>
      {open && (
        <ul className="absolute top-full right-0 z-30 mt-1 w-44 origin-top-right rounded-tile bg-white p-1.5 shadow-float ring-1 ring-line motion-safe:animate-drop">
          {memberAccountRoles.map((option) => (
            <li key={option}>
              <button
                type="button"
                aria-pressed={option === role}
                onClick={() => choose(option)}
                className="flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-left text-sm font-medium transition-colors hover:bg-canvas"
              >
                <span className="flex-1">{roleLabels[option]}</span>
                {option === role && (
                  <NavIconSvg icon="check" className="size-4" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The bin in Account actions. Deleting wipes a member's whole history, so
 * an active member gets a tip to mark them inactive first (one tap, right
 * there); only an inactive member gets the delete form.
 */
function DeleteButton({ detail }: { detail: MemberDetail }) {
  const [open, setOpen] = useState(false);
  const { member } = detail;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Delete member"
        title="Delete member"
        className="flex size-10 shrink-0 items-center justify-center rounded-control text-muted ring-1 ring-line transition-colors hover:bg-ink hover:text-white"
      >
        <NavIconSvg icon="trash" className="size-5" />
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={member.isActive ? "Mark inactive first" : "Delete member"}
      >
        {member.isActive ? (
          <>
            <p className="text-sm">
              {firstName(member.fullName)} is still active. Mark them inactive
              first: most of the time that&rsquo;s enough. It keeps their
              payments and visits, and they can be reactivated later.
            </p>
            <ActionForm
              action={deactivateMember}
              submitLabel="Mark inactive"
              success="Marked inactive."
              variant="outline-dark"
            >
              <input type="hidden" name="memberId" value={member.id} />
            </ActionForm>
          </>
        ) : (
          <DeleteMemberForm detail={detail} />
        )}
      </Dialog>
    </>
  );
}

function Stat({
  label,
  value,
  note,
  dark = false,
}: {
  label: string;
  value: string;
  note?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-tile p-3 ${dark ? "bg-ink text-white" : "bg-canvas"}`}
    >
      <dt className={`text-xs ${dark ? "text-white/60" : "text-muted"}`}>
        {label}
      </dt>
      <dd className="mt-1 truncate text-lg font-semibold tracking-tight tabular-nums">
        {value}
      </dd>
      {note && (
        <dd
          className={`truncate text-xs ${dark ? "text-white/60" : "text-muted"}`}
        >
          {note}
        </dd>
      )}
    </div>
  );
}

function FeeForm({ detail }: { detail: MemberDetail }) {
  const membership = detail.membership!;
  return (
    <>
      <ActionForm
        action={changeFee}
        submitLabel="Change fee"
        className="max-w-lg space-y-4"
      >
        <input type="hidden" name="memberId" value={detail.member.id} />
        <input type="hidden" name="membershipId" value={membership.id} />
        <Field label="New monthly fee (₹)">
          <input
            name="fee"
            inputMode="decimal"
            required
            defaultValue={
              membership.feePaise !== null
                ? paiseToInput(membership.feePaise)
                : ""
            }
            className={inputClass}
          />
        </Field>
        <Field label="Reason (optional)">
          <input name="note" maxLength={200} className={inputClass} />
        </Field>
      </ActionForm>
      {membership.fees.length > 0 && (
        <History title="Fee history">
          {membership.fees.map((fee) => (
            <li key={fee.createdAt.toISOString()}>
              <strong>
                {fee.feePaise === 0 ? "Free" : formatPaise(fee.feePaise)}
              </strong>{" "}
              from {formatDate(fee.effectiveFrom)}
              {fee.note && <span className="text-muted"> · {fee.note}</span>}
            </li>
          ))}
        </History>
      )}
    </>
  );
}

function DueDateForm({
  detail,
  dueOn,
}: {
  detail: MemberDetail;
  dueOn: string | null;
}) {
  return (
    <ActionForm
      action={changeDueDate}
      submitLabel="Change due date"
      className="max-w-lg space-y-4"
    >
      <input type="hidden" name="memberId" value={detail.member.id} />
      <input type="hidden" name="membershipId" value={detail.membership!.id} />
      <Field label="Next due" hint="Later months follow this day.">
        <input
          name="dueOn"
          type="date"
          required
          defaultValue={dueOn ?? undefined}
          className={inputClass}
        />
      </Field>
    </ActionForm>
  );
}

function DetailsForm({ detail }: { detail: MemberDetail }) {
  const { member } = detail;
  return (
    <>
      <ActionForm
        action={updateMember}
        submitLabel="Save details"
        success="Saved."
        className="max-w-lg space-y-4"
      >
        <input type="hidden" name="memberId" value={member.id} />
        <Field label="Full name">
          <input
            name="fullName"
            required
            maxLength={120}
            defaultValue={member.fullName}
            className={inputClass}
          />
        </Field>
        <Field label="Mobile number">
          <input
            name="phone"
            type="tel"
            required
            defaultValue={member.phone}
            className={inputClass}
          />
        </Field>
        <Checkbox
          name="reminderConsent"
          label="Payment reminders"
          defaultChecked={member.reminderConsentAt !== null}
        />
        <Checkbox
          name="remindersMuted"
          label="Mute payment reminders"
          defaultChecked={member.remindersMuted}
        />
      </ActionForm>

      {member.isActive && (
        <ActionForm
          action={deactivateMember}
          submitLabel="Mark inactive"
          variant="outline-dark"
          className="mt-6 max-w-lg border-t border-line pt-6"
        >
          <input type="hidden" name="memberId" value={member.id} />
        </ActionForm>
      )}
    </>
  );
}

function DeleteMemberForm({ detail }: { detail: MemberDetail }) {
  const { member } = detail;
  return (
    <ActionForm
      action={deleteMember}
      submitLabel="Delete forever"
      pendingLabel="Deleting…"
      className="max-w-lg space-y-4"
    >
      <p className="text-sm">
        This removes {member.fullName}, their memberships, payments, visits and
        reminders, and their entries in the audit log. It can&rsquo;t be undone.
        The audit log keeps one line saying you deleted{" "}
        <span className="font-mono">{member.memberCode}</span>.
      </p>
      <input type="hidden" name="memberId" value={member.id} />
      <Field label={`Type ${member.memberCode} to confirm`}>
        <input
          name="confirmCode"
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
          className={`${inputClass} font-mono`}
        />
      </Field>
    </ActionForm>
  );
}

function FreezeControls({
  detail,
  today,
}: {
  detail: MemberDetail;
  today: string;
}) {
  const membership = detail.membership!;
  const open = membership.freezes.find(
    (freeze) => freeze.endsOn === null || freeze.endsOn >= today,
  );

  const history = membership.freezes.length > 0 && (
    <History title="Freezes">
      {membership.freezes.map((freeze) => (
        <li key={freeze.id}>
          {formatDate(freeze.startsOn)} to{" "}
          {freeze.endsOn ? formatDate(freeze.endsOn) : "no end date"}
          {freeze.note && <span className="text-muted"> · {freeze.note}</span>}
        </li>
      ))}
    </History>
  );

  if (open) {
    return (
      <>
        <ActionForm
          action={endFreeze}
          submitLabel="End freeze"
          success="Freeze ended."
          className="max-w-lg space-y-4"
        >
          <input type="hidden" name="memberId" value={detail.member.id} />
          <input type="hidden" name="freezeId" value={open.id} />
          <Field label="Last frozen day">
            <input
              name="endsOn"
              type="date"
              required
              defaultValue={today}
              className={inputClass}
            />
          </Field>
        </ActionForm>
        {history}
      </>
    );
  }

  return (
    <>
      <ActionForm
        action={freezeMembership}
        submitLabel="Freeze"
        success="Frozen."
        className="max-w-lg space-y-4"
      >
        <input type="hidden" name="memberId" value={detail.member.id} />
        <input type="hidden" name="membershipId" value={membership.id} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <input
              name="startsOn"
              type="date"
              required
              defaultValue={today}
              className={inputClass}
            />
          </Field>
          <Field label="Until (optional)">
            <input name="endsOn" type="date" className={inputClass} />
          </Field>
        </div>
        <Field label="Reason (optional)">
          <input
            name="note"
            maxLength={200}
            placeholder="e.g. travelling, injury"
            className={inputClass}
          />
        </Field>
      </ActionForm>
      {history}
    </>
  );
}

function claimStatusText(claim: MemberDetail["claimLink"]): string {
  switch (claim.state) {
    case "open":
      return `link works until ${formatDateTime(claim.expiresAt!)}`;
    case "expired":
      return "last link expired";
    case "revoked":
      return "last link was replaced";
    case "used":
      return "claimed";
    default:
      return "—";
  }
}

function firstName(fullName: string): string {
  return fullName.split(/\s+/)[0] ?? fullName;
}

function History({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6 border-t border-line pt-5">
      <h3 className="text-sm font-medium text-muted">{title}</h3>
      <ul className="mt-2 space-y-1 text-sm">{children}</ul>
    </div>
  );
}
