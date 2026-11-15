import type { Metadata } from "next";
import Link from "next/link";
import { contact, gym } from "@/content/landing";
import { ContactLines, LegalPage } from "@/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of use",
  description: `The rules for using the ${gym.fullName} website and member app.`,
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="16 November 2026">
      <section>
        <p>
          These terms cover the {gym.fullName} website and member app. By
          signing in you agree to them. Your membership itself (fees, gym rules,
          safety) is agreed with the gym at the front desk; these terms are only
          about using the app.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <ul>
          <li>You sign in with your own Google account. Keep it secure.</li>
          <li>
            Use only your own account and your own membership. Don&apos;t share
            your sign-in or check in for someone else.
          </li>
          <li>
            Tell the front desk if your phone number changes or something in the
            app looks wrong.
          </li>
        </ul>
      </section>

      <section>
        <h2>Check-in</h2>
        <p>
          Check in by scanning the QR code at the front desk while you are at
          the gym, once a day. Checking in from anywhere else, or reusing a
          photo of the code, is not allowed.
        </p>
      </section>

      <section>
        <h2>Fees and payments</h2>
        <p>
          The app shows your fee, due date and the payments the gym has
          recorded. You pay at the front desk; the app does not take payments.
          If a record looks wrong, tell us and we will check it against our
          receipts. The gym&apos;s records decide any dispute.
        </p>
      </section>

      <section>
        <h2>Staff accounts</h2>
        <p>
          Staff may use the app only for gym work and only within their role.
          Member information must not be copied, shared or used for anything
          else. The owner can switch off a staff account at any time.
        </p>
      </section>

      <section>
        <h2>Fair use</h2>
        <p>
          Don&apos;t try to get into other people&apos;s information, break or
          overload the app, or get around its security checks. We may suspend an
          account that does.
        </p>
      </section>

      <section>
        <h2>Availability</h2>
        <p>
          We work to keep the app running and accurate, but it may sometimes be
          unavailable or contain mistakes. It is provided as is. If the app is
          down, the front desk can check you in and record payments by hand.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          We may update these terms. The date at the top shows the latest
          version. If you keep using the app after a change, the new terms
          apply.
        </p>
      </section>

      <section>
        <h2>Contact us</h2>
        <ContactLines {...contact} />
        <p>
          How we handle your information is explained in our{" "}
          <Link href="/privacy">privacy policy</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
