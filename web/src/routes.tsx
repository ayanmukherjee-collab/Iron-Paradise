import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import type { Action } from "@/auth/permissions";
import { AppShell } from "./app-shell";
import { RequirePermission, RequireViewer } from "./auth/viewer";
// Eager: these are written into the HTML at build time, and the app must
// draw the same markup on its first render, with nothing to wait for.
import { LandingPage, PrivacyPage, TermsPage } from "./pages/site";

// Each screen is its own file, fetched the first time it opens (and kept by
// the service worker), so the first load on a phone stays small.
const AttendancePage = lazy(() =>
  import("./pages/attendance").then((m) => ({ default: m.AttendancePage })),
);
const AuditPage = lazy(() =>
  import("./pages/audit").then((m) => ({ default: m.AuditPage })),
);
const CheckInPage = lazy(() =>
  import("./pages/check-in").then((m) => ({ default: m.CheckInPage })),
);
const CheckInSetupPage = lazy(() =>
  import("./pages/check-in-setup").then((m) => ({
    default: m.CheckInSetupPage,
  })),
);
const PaymentsExportPage = lazy(() =>
  import("./pages/downloads").then((m) => ({ default: m.PaymentsExportPage })),
);
const PrintedQrPage = lazy(() =>
  import("./pages/downloads").then((m) => ({ default: m.PrintedQrPage })),
);
const GuestsPage = lazy(() =>
  import("./pages/guests").then((m) => ({ default: m.GuestsPage })),
);
const HomePage = lazy(() =>
  import("./pages/home").then((m) => ({ default: m.HomePage })),
);
const MemberPage = lazy(() =>
  import("./pages/member").then((m) => ({ default: m.MemberPage })),
);
const MembersPage = lazy(() =>
  import("./pages/members").then((m) => ({ default: m.MembersPage })),
);
const NewMemberPage = lazy(() =>
  import("./pages/new-member").then((m) => ({ default: m.NewMemberPage })),
);
const NotFound = lazy(() =>
  import("./pages/not-found").then((m) => ({ default: m.NotFound })),
);
const RecordPaymentPage = lazy(() =>
  import("./pages/pay").then((m) => ({ default: m.RecordPaymentPage })),
);
const PaymentsPage = lazy(() =>
  import("./pages/payments").then((m) => ({ default: m.PaymentsPage })),
);
const ClaimPage = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.ClaimPage })),
);
const DeskPage = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.DeskPage })),
);
const OfflinePage = lazy(() =>
  import("./pages/public").then((m) => ({ default: m.OfflinePage })),
);
const RemindersPage = lazy(() =>
  import("./pages/reminders").then((m) => ({ default: m.RemindersPage })),
);
const SettingsPage = lazy(() =>
  import("./pages/settings").then((m) => ({ default: m.SettingsPage })),
);
const AuthCallbackPage = lazy(() =>
  import("./pages/sign-in").then((m) => ({ default: m.AuthCallbackPage })),
);
const SignInPage = lazy(() =>
  import("./pages/sign-in").then((m) => ({ default: m.SignInPage })),
);
const TeamPage = lazy(() =>
  import("./pages/team").then((m) => ({ default: m.TeamPage })),
);

function Loading() {
  return (
    <p role="status" className="sr-only">
      Loading…
    </p>
  );
}

/** A screen, shown once its code has arrived. */
function page(element: ReactNode) {
  return <Suspense fallback={<Loading />}>{element}</Suspense>;
}

/** A screen only people with `action` may open; the rest go Home. */
function only(action: Action, element: ReactNode) {
  return page(<RequirePermission action={action}>{element}</RequirePermission>);
}

// The same addresses as the Next.js app, so links, bookmarks, QR codes and
// claim links keep working. Permissions match each page's requirePermission.
export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/privacy", element: <PrivacyPage /> },
  { path: "/terms", element: <TermsPage /> },
  { path: "/sign-in", element: page(<SignInPage />) },
  { path: "/auth/callback", element: page(<AuthCallbackPage />) },
  { path: "/claim/:token", element: page(<ClaimPage />) },
  { path: "/desk/:token", element: page(<DeskPage />) },
  { path: "/~offline", element: page(<OfflinePage />) },
  {
    path: "/app",
    element: (
      <RequireViewer>
        <AppShell />
      </RequireViewer>
    ),
    children: [
      { index: true, element: page(<HomePage />) },
      { path: "check-in", element: only("self.checkIn", <CheckInPage />) },
      { path: "members", element: only("members.view", <MembersPage />) },
      {
        path: "members/new",
        element: only("members.edit", <NewMemberPage />),
      },
      { path: "members/:id", element: only("members.view", <MemberPage />) },
      {
        path: "members/:id/pay",
        element: only("payments.record", <RecordPaymentPage />),
      },
      {
        path: "payments",
        element: only("payments.viewSheet", <PaymentsPage />),
      },
      {
        path: "payments/export",
        element: only("payments.viewSheet", <PaymentsExportPage />),
      },
      {
        path: "attendance",
        element: only("attendance.view", <AttendancePage />),
      },
      {
        path: "attendance/setup",
        element: only("desk.manage", <CheckInSetupPage />),
      },
      {
        path: "attendance/setup/printed-qr",
        element: only("desk.manage", <PrintedQrPage />),
      },
      { path: "audit", element: only("audit.view", <AuditPage />) },
      { path: "guests", element: only("guests.link", <GuestsPage />) },
      { path: "reminders", element: only("reminders.send", <RemindersPage />) },
      { path: "settings", element: only("plans.edit", <SettingsPage />) },
      { path: "team", element: only("roles.change", <TeamPage />) },
      { path: "*", element: page(<NotFound />) },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
