import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requirePermission, viewerCan } from "@/auth/session";
import { ActionForm } from "@/components/ui/action-form";
import { Checkbox, Field, inputClass } from "@/components/ui/field";
import { gym } from "@/content/landing";
import { formatDate, formatDateTime, todayAtGym } from "@/lib/dates";
import { formatPaise, paiseToInput } from "@/lib/money";
import {
  changeFee,
  createClaimLink,
  deactivateMember,
  endFreeze,
  freezeMembership,
  reactivateMember,
  updateMember,
} from "@/members/actions";
import { ClaimLinkPanel } from "@/members/components/claim-link-panel";
import { NewMembershipFields } from "@/members/components/new-membership-fields";
import { StatusBadge } from "@/members/components/status-badge";
import { formatMobile, whatsAppLink } from "@/members/phone";
import { MemberPayments } from "@/payments/components/member-payments";
import { getMemberPayments } from "@/payments/queries";
import {
  getMemberDetail,
  listPlans,
  type MemberDetail,
} from "@/members/queries";

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
  const plans =
    canEdit && status === "inactive" ? await listPlans(viewer, true) : [];
  const today = todayAtGym();

  return (
    <article className="space-y-10">
      <header>
        <Link
          href="/app/members"
          className="text-sm font-semibold underline underline-offset-4"
        >
          All members
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="display text-5xl">{member.fullName}</h1>
          <StatusBadge status={status} />
        </div>
        <dl className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="text-smoke">Member ID</dt>
          <dd>
            <span className="font-mono text-2xl font-bold">
              {member.memberCode}
            </span>
            <span className="ml-3 text-sm text-smoke">
              Write this on their fee slips
            </span>
          </dd>
          <dt className="text-smoke">Mobile</dt>
          <dd>
            <a
              href={whatsAppLink(
                member.phone,
                `Hi ${firstName(member.fullName)}, `,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-4"
            >
              {formatMobile(member.phone)}
            </a>
            {member.remindersMuted && (
              <span className="ml-3 text-sm text-smoke">Reminders muted</span>
            )}
          </dd>
          <dt className="text-smoke">Account</dt>
          <dd>{detail.accountEmail ?? "Not linked yet"}</dd>
        </dl>
      </header>

      {membership ? (
        <Section title="Membership">
          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-[auto_1fr]">
            <dt className="text-smoke">Since</dt>
            <dd>
              {formatDate(membership.startsOn)}
              {membership.planName && ` · ${membership.planName}`}
            </dd>
            {membership.feePaise !== null && (
              <>
                <dt className="text-smoke">Agreed fee</dt>
                <dd className="font-semibold">
                  {membership.feePaise === 0
                    ? "Free"
                    : `${formatPaise(membership.feePaise)} a month`}
                </dd>
              </>
            )}
            <dt className="text-smoke">Next due</dt>
            <dd>
              {status === "free"
                ? "Nothing, free member"
                : membership.nextDue
                  ? formatDate(membership.nextDue)
                  : "On hold until the freeze ends"}
            </dd>
            {membership.activeFreeze && (
              <>
                <dt className="text-smoke">Frozen</dt>
                <dd>
                  From {formatDate(membership.activeFreeze.startsOn)}
                  {membership.activeFreeze.endsOn
                    ? ` to ${formatDate(membership.activeFreeze.endsOn)}`
                    : ", no end date"}
                </dd>
              </>
            )}
          </dl>

          {canEditMembership && (
            <div className="mt-8 grid gap-10 lg:grid-cols-2">
              <ActionForm
                action={changeFee}
                submitLabel="Change fee"
                className="space-y-4"
              >
                <h3 className="text-lg font-bold">Change the agreed fee</h3>
                <p className="text-smoke">
                  Takes effect from the next due date. Months already due keep
                  their fee.
                </p>
                <input type="hidden" name="memberId" value={member.id} />
                <input
                  type="hidden"
                  name="membershipId"
                  value={membership.id}
                />
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
                <Field
                  label="Reason (optional)"
                  hint="e.g. student discount, agreed at the desk"
                >
                  <input name="note" maxLength={200} className={inputClass} />
                </Field>
              </ActionForm>

              <FreezeControls detail={detail} today={today} />
            </div>
          )}

          {membership.fees.length > 0 && (
            <History title="Fee history">
              {membership.fees.map((fee) => (
                <li key={fee.createdAt.toISOString()}>
                  <strong>
                    {fee.feePaise === 0 ? "Free" : formatPaise(fee.feePaise)}
                  </strong>{" "}
                  from {formatDate(fee.effectiveFrom)}
                  {fee.note && (
                    <span className="text-smoke"> · {fee.note}</span>
                  )}
                  <span className="text-smoke">
                    {" "}
                    · set {formatDateTime(fee.createdAt)}
                  </span>
                </li>
              ))}
            </History>
          )}
          {membership.freezes.length > 0 && (
            <History title="Freezes">
              {membership.freezes.map((freeze) => (
                <li key={freeze.id}>
                  {formatDate(freeze.startsOn)} to{" "}
                  {freeze.endsOn ? formatDate(freeze.endsOn) : "no end date"}
                  {freeze.note && (
                    <span className="text-smoke"> · {freeze.note}</span>
                  )}
                </li>
              ))}
            </History>
          )}
        </Section>
      ) : (
        <Section title="Membership">
          <p className="text-lg">
            No current membership. Their history is kept below.
          </p>
          {canEdit && (
            <ActionForm
              action={reactivateMember}
              submitLabel="Reactivate"
              className="mt-6 max-w-lg space-y-4"
            >
              <p className="text-smoke">
                Starts a fresh membership. The months they were away are not
                charged.
              </p>
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
          )}
        </Section>
      )}

      {canLink && !member.profileId && member.isActive && (
        <Section title="Claim link">
          <p className="mb-4 max-w-prose text-smoke">
            Lets them sign in with Google and see their own membership. Status:{" "}
            <strong className="text-ink">
              {claimStatusText(detail.claimLink)}
            </strong>
          </p>
          <ClaimLinkPanel
            memberId={member.id}
            firstName={firstName(member.fullName)}
            phone={member.phone}
            gymName={gym.fullName}
            hasOpenLink={detail.claimLink.state === "open"}
            createClaimLink={createClaimLink}
          />
        </Section>
      )}

      {payments && (
        <Section title="Payments">
          <MemberPayments
            memberId={member.id}
            data={payments}
            canRecord={viewerCan(viewer, "payments.record")}
            canVoid={viewerCan(viewer, "payments.void")}
            today={today}
          />
        </Section>
      )}

      <Section title="Visits">
        {detail.visits.length === 0 ? (
          <p className="text-smoke">No visits recorded yet.</p>
        ) : (
          <ul className="space-y-1">
            {detail.visits.map((visit) => (
              <li key={visit.gymDate}>
                {formatDate(visit.gymDate)}
                <span className="text-smoke">
                  {" "}
                  · {visit.method === "qr" ? "QR" : "Marked by staff"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {canEdit && (
        <Section title="Details">
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
              className="mt-10 max-w-lg"
            >
              <h3 className="text-lg font-bold">Mark inactive</h3>
              <p className="mt-1 text-smoke">
                Ends their membership today and stops reminders. Nothing is
                deleted, and you can reactivate them any time.
              </p>
              <input type="hidden" name="memberId" value={member.id} />
            </ActionForm>
          )}
        </Section>
      )}

      {detail.pastMemberships.length > 0 && (
        <Section title="Past memberships">
          <ul className="space-y-1">
            {detail.pastMemberships.map((past) => (
              <li key={past.id}>
                {formatDate(past.startsOn)} to {formatDate(past.endedOn!)}
                {past.planName && (
                  <span className="text-smoke"> · {past.planName}</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </article>
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

  if (open) {
    return (
      <ActionForm
        action={endFreeze}
        submitLabel="End freeze"
        success="Freeze ended."
        className="space-y-4"
      >
        <h3 className="text-lg font-bold">End the freeze</h3>
        <p className="text-smoke">
          Due dates move back by however long the freeze lasted.
        </p>
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
    );
  }

  return (
    <ActionForm
      action={freezeMembership}
      submitLabel="Freeze"
      success="Frozen."
      className="space-y-4"
    >
      <h3 className="text-lg font-bold">Freeze</h3>
      <p className="text-smoke">
        No fees fall due while frozen. Leave the end blank if you don&apos;t
        know it yet.
      </p>
      <input type="hidden" name="memberId" value={detail.member.id} />
      <input type="hidden" name="membershipId" value={membership.id} />
      <div className="grid grid-cols-2 gap-4">
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
  );
}

function claimStatusText(claim: MemberDetail["claimLink"]): string {
  switch (claim.state) {
    case "open":
      return `link sent, works until ${formatDateTime(claim.expiresAt!)}`;
    case "expired":
      return "last link expired";
    case "revoked":
      return "last link was replaced";
    case "used":
      return "claimed";
    default:
      return "no link sent yet";
  }
}

function firstName(fullName: string): string {
  return fullName.split(/\s+/)[0] ?? fullName;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t-2 border-ink pt-6">
      <h2 className="mb-4 display text-3xl">{title}</h2>
      {children}
    </section>
  );
}

function History({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-8">
      <h3 className="text-lg font-bold">{title}</h3>
      <ul className="mt-2 space-y-1">{children}</ul>
    </div>
  );
}
