import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { markAttendance } from "@/attendance/actions";
import { roleLabels } from "@/auth/permissions";
import { requirePermission, viewerCan } from "@/auth/session";
import { changeMemberRole } from "@/auth/team-actions";
import { memberAccountRoles } from "@/auth/team-queries";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { ActionForm } from "@/components/ui/action-form";
import { BackLink } from "@/components/ui/back-link";
import { Disclosure } from "@/components/ui/disclosure";
import { Checkbox, Field, inputClass } from "@/components/ui/field";
import { Tabs, type Tab } from "@/components/ui/tabs";
import { gym } from "@/content/landing";
import {
  formatDate,
  formatDateTime,
  formatShortDate,
  todayAtGym,
} from "@/lib/dates";
import { formatPaise, paiseToInput } from "@/lib/money";
import {
  changeFee,
  createClaimLink,
  deactivateMember,
  deleteMember,
  endFreeze,
  freezeMembership,
  reactivateMember,
  updateMember,
} from "@/members/actions";
import { ClaimLinkPanel } from "@/members/components/claim-link-panel";
import { NewMembershipFields } from "@/members/components/new-membership-fields";
import { StatusBadge } from "@/members/components/status-badge";
import { formatMobile, whatsAppLink } from "@/members/phone";
import {
  getMemberDetail,
  listPlans,
  type MemberDetail,
} from "@/members/queries";
import { PaymentHistory } from "@/payments/components/payment-history";
import { standingLabels } from "@/payments/describe";
import { getMemberPayments } from "@/payments/queries";

export const metadata: Metadata = { title: "Member" };

export default async function MemberPage({
  params,
}: PageProps<"/app/members/[id]">) {
  const { id } = await params;
  const viewer = await requirePermission("members.view", `/app/members/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [detail, payments] = await Promise.all([
    getMemberDetail(viewer, id),
    viewerCan(viewer, "payments.viewSheet")
      ? getMemberPayments(viewer, id)
      : null,
  ]);
  if (!detail) notFound();

  const { member, membership, status } = detail;
  const canEdit = viewerCan(viewer, "members.edit");
  const canEditMembership = viewerCan(viewer, "memberships.edit");
  const canLink = viewerCan(viewer, "guests.link");
  const canMark = viewerCan(viewer, "attendance.mark");
  const canRecord = viewerCan(viewer, "payments.record");
  const canChangeType = viewerCan(viewer, "roles.change");
  const canDelete = viewerCan(viewer, "members.delete");
  const plans =
    canEdit && status === "inactive" ? await listPlans(viewer, true) : [];
  const today = todayAtGym();
  const inToday = detail.visits.some((visit) => visit.gymDate === today);
  const visitsThisMonth = detail.visits.filter((visit) =>
    visit.gymDate.startsWith(today.slice(0, 7)),
  ).length;
  const lastVisit = detail.visits[0]?.gymDate ?? null;
  const ledger = payments?.ledger ?? null;
  const owes = (ledger?.owedPaise ?? 0) > 0;

  const actionTabs: Tab[] = [
    ...(canEditMembership && membership
      ? [
          {
            id: "fee",
            label: "Change fee",
            content: <FeeForm detail={detail} />,
          },
        ]
      : []),
    ...(canEdit
      ? [
          {
            id: "details",
            label: "Edit details",
            content: <DetailsForm detail={detail} />,
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

  return (
    <article className="space-y-4">
      <header className="page-header">
        <BackLink href="/app/members" label="Members" className="mb-1" />
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 page-title break-words">{member.fullName}</h1>
          <StatusBadge status={status} />
        </div>
      </header>

      {/* Who they are and where they stand, at a glance. */}
      <section className="card p-5 sm:p-6">
        <div>
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
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <NavIconSvg icon="user" className="size-4 shrink-0" />
              <span className="truncate">
                {detail.accountEmail
                  ? `${detail.accountEmail}${detail.accountRole && detail.accountRole !== "member" ? ` · ${roleLabels[detail.accountRole]}` : ""}`
                  : member.profileId
                    ? "App account linked"
                    : "No app account yet"}
              </span>
            </p>
          </div>
        </div>

        <dl
          className={`mt-5 grid gap-2 ${payments ? "grid-cols-3" : "grid-cols-2"}`}
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
                  ? undefined
                  : ledger?.nextUnpaid
                    ? `Next ${formatShortDate(ledger.nextUnpaid.dueOn, today)}`
                    : status === "frozen"
                      ? "On hold"
                      : undefined
              }
            />
          )}
          <Stat
            label="This month"
            value={String(visitsThisMonth)}
            note={
              inToday
                ? "In today"
                : lastVisit
                  ? `Last ${formatShortDate(lastVisit, today)}`
                  : "—"
            }
          />
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
                  ? "a month"
                  : `Since ${formatShortDate(membership.startsOn, today)}`
                : undefined
            }
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

        {((canRecord && ledger) ||
          (canMark && status !== "inactive" && !inToday)) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {canRecord && ledger && (
              <Link
                href={`/app/members/${member.id}/pay`}
                className="btn-dark flex-1 sm:flex-none"
              >
                Record payment
              </Link>
            )}
            {canMark && status !== "inactive" && !inToday && (
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

      {actionTabs.length > 0 && (
        <Disclosure title="Account actions" icon="sliders">
          <Tabs tabs={actionTabs} label="Account actions" />
        </Disclosure>
      )}

      {canChangeType && member.profileId && detail.accountRole && (
        <section className="card p-4 sm:px-6 sm:py-5">
          <ActionForm
            action={changeMemberRole}
            submitLabel="Save"
            className="flex flex-wrap items-end gap-3 [&>div]:mt-0"
          >
            <input type="hidden" name="memberId" value={member.id} />
            <Field label="Member type" className="min-w-48 flex-1">
              <select
                name="role"
                defaultValue={detail.accountRole}
                className={inputClass}
              >
                {memberAccountRoles.map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role]}
                  </option>
                ))}
              </select>
            </Field>
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
        <Disclosure
          title="Payment history"
          summary={
            payments.history.length === 0
              ? "—"
              : `${payments.history.length} ${payments.history.length === 1 ? "payment" : "payments"}`
          }
          icon="payments"
        >
          <PaymentHistory
            history={payments.history}
            canVoid={viewerCan(viewer, "payments.void")}
            today={today}
          />
        </Disclosure>
      )}

      <Disclosure
        title="Visit history"
        summary={
          detail.visits.length === 0
            ? "—"
            : `Last ${formatShortDate(lastVisit!, today)} · ${visitsThisMonth} this month`
        }
        icon="attendance"
      >
        {detail.visits.length === 0 ? (
          <p className="text-muted">No visits recorded yet.</p>
        ) : (
          <ul className="list-card">
            {detail.visits.map((visit) => (
              <li
                key={visit.gymDate}
                className="flex justify-between gap-3 list-row py-3 text-sm"
              >
                <span>{formatDate(visit.gymDate)}</span>
                <span className="text-muted">
                  {visit.method === "qr" ? "Scanned QR" : "Marked by staff"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Disclosure>

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

      {canDelete && (
        <Disclosure
          title="Delete member"
          summary="Permanent: removes every record of them"
          icon="close"
        >
          <DeleteMemberForm detail={detail} />
        </Disclosure>
      )}
    </article>
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
  if (member.isActive) {
    return (
      <p className="text-sm text-muted">
        Mark {firstName(member.fullName)} inactive first (Account actions → Edit
        details). Most of the time that is enough: it keeps their history.
      </p>
    );
  }
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
