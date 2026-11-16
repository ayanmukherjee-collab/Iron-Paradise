import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { contact, gym } from "@/content/landing";
import { ContactLines, LegalPage } from "@/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `How ${gym.fullName} collects, uses and protects your information.`,
};

// Written from what the app actually stores (src/db/schema.ts) and the
// services it runs on. Update this page when either changes.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="16 November 2026">
      <section>
        <p>
          {gym.fullName} (&ldquo;we&rdquo;) runs this website and the member app
          to manage memberships, fees and attendance at the gym. This page
          explains what we collect, why, who handles it for us, and what you can
          ask us to do with it. We collect as little as we can.
        </p>
      </section>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>From your Google account, when you sign in:</strong> your
            name and email address. We use Google only to confirm who you are.
            We never see or store your Google password, and we ask for no other
            Google data.
          </li>
          <li>
            <strong>Your membership:</strong> your name, phone number, member
            ID, plan, the fee agreed with you, when your membership started, and
            any freezes.
          </li>
          <li>
            <strong>Payments:</strong> the amount, the date, the receipt number
            and who recorded it. We do not take card or bank details; you pay at
            the front desk.
          </li>
          <li>
            <strong>Attendance:</strong> the date and time each time you check
            in.
          </li>
          <li>
            <strong>Staff accounts:</strong> name, email and role.
          </li>
          <li>
            <strong>Security records:</strong> a log of changes staff make to
            memberships, roles and payments (who, what and when), and your IP
            address for a short time to limit repeated sign-in attempts and
            block bots.
          </li>
        </ul>
        <p>
          We do not collect ID numbers, home addresses or health information.
        </p>
      </section>

      <section>
        <h2>How we use it</h2>
        <ul>
          <li>
            To run your membership: who you are, what you pay, when it is due.
          </li>
          <li>To record check-ins and show you your visit history.</li>
          <li>To keep accurate payment records and correct mistakes.</li>
          <li>
            To send fee reminders, only if you agreed to them: a notification on
            your phone if you turn them on in the app, an email to your sign-in
            address, or a WhatsApp message from the front desk. You can ask the
            front desk to stop them at any time.
          </li>
          <li>To keep the app secure and prevent abuse.</li>
        </ul>
        <p>
          We do not sell your information, use it for advertising, or share it
          with anyone except the service providers below. Our use of information
          received from Google follows the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including its Limited Use requirements.
        </p>
      </section>

      <section>
        <h2>Who can see it</h2>
        <p>
          You can see your own membership, payments and visits. Gym staff see
          what their role needs: every staff member can see member details,
          attendance and whether fees are paid; only the owner and managers
          record payments and see the full payment records; only the owner can
          void a payment. These limits are enforced by the database itself, not
          just by hiding screens.
        </p>
      </section>

      <section>
        <h2>Service providers</h2>
        <ul>
          <li>
            <strong>Google</strong>, for sign-in.
          </li>
          <li>
            <strong>Supabase</strong>, which stores our database in Mumbai,
            India.
          </li>
          <li>
            <strong>Cloudflare</strong>, which hosts the app, checks for bots
            (Turnstile), and will store our encrypted backups.
          </li>
          <li>
            <strong>Upstash</strong>, which counts requests per IP address for
            rate limiting.
          </li>
          <li>
            <strong>Resend</strong>, which sends our reminder emails.
          </li>
          <li>
            <strong>Your browser&apos;s push service</strong> (Google, Apple,
            Mozilla or Microsoft), which delivers phone notifications. The
            message is encrypted so the push service cannot read it.
          </li>
        </ul>
        <p>
          They process information only to provide their service to us. Some of
          it may pass through their servers outside India.
        </p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>
          Payment and attendance records are kept for as long as we need them
          for our accounts and to settle any dispute. When you leave, your
          membership is marked inactive rather than erased, so the history stays
          accurate. Rate-limit counters, which hold IP addresses, expire within
          a few hours.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <p>You can ask us to:</p>
        <ul>
          <li>show you the information we hold about you;</li>
          <li>correct anything that is wrong;</li>
          <li>stop fee reminders;</li>
          <li>
            close your account and unlink your Google sign-in. We then stop
            using your details for anything except the records we must keep;
          </li>
          <li>
            delete what we are not required to keep. We will tell you what has
            to stay and why.
          </li>
        </ul>
        <p>
          You can also remove this app&apos;s access to your Google account at
          any time from your{" "}
          <a
            href="https://myaccount.google.com/connections"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google account settings
          </a>
          .
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          Connections are encrypted, staff each have their own account, every
          sign-in goes through Google, and access is checked on every request.
          No system is perfectly secure; if something goes wrong that affects
          your information, we will tell you.
        </p>
      </section>

      <section>
        <h2>Contact us</h2>
        <p>For any privacy question or request:</p>
        <ContactLines {...contact} />
        <p>
          We may update this policy. The date at the top shows the latest
          version. See also our <Link href="/terms">terms of use</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
