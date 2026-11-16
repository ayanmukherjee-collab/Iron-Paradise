/**
 * Everything the public landing page says lives here, so the owner can change
 * text, plans, hours and contact details without touching any component.
 *
 * Values marked PLACEHOLDER are stand-ins until the owner confirms the real
 * ones. Prices are deliberately not published; the plans section points
 * people to the desk or WhatsApp instead.
 */

export type Plan = {
  name: string;
  months: number;
  note: string;
  featured?: boolean;
};

export type Facility = {
  name: string;
  detail: string;
};

export type ArcStep = {
  when: string;
  what: string;
};

export type HoursRow = {
  days: string;
  slots: string[];
};

/**
 * Character art. `file` names the WebP files that `npm run art` writes to
 * public/art; width and height are the 960px version's, used for aspect ratio.
 * To swap art: drop a transparent PNG in assets/art, add it to
 * scripts/process-art.mjs, run `npm run art`, and update the entry here.
 */
export type Art = {
  file: string;
  width: number;
  height: number;
};

export const art = {
  hero: { file: "goku", width: 960, height: 1830 },
  arc: { file: "asta", width: 960, height: 948 },
  closing: { file: "saitama", width: 960, height: 1406 },
} satisfies Record<string, Art>;

export const gym = {
  name: "Iron Paradise",
  fullName: "Iron Paradise Gym",
  description:
    "A no-nonsense strength gym. Free weights, racks, machines and trainers on the floor. Plans, hours and directions inside.",
};

export const contact = {
  // The owner's number, for calls and WhatsApp (owner, 2026-11-16).
  phoneDisplay: "+91 87970 02647",
  phoneHref: "tel:+918797002647",
  whatsappNumber: "918797002647",
  addressLines: [
    "Near Bank of Baroda",
    "Bundu, Ranchi 835204",
    "Jharkhand, India",
  ],
  mapsUrl: "https://maps.app.goo.gl/1S3FUJhDWSiPHZij7",
  instagramHandle: "ip_fit_gym",
  whatsappCommunityUrl: "https://chat.whatsapp.com/C7rWOtn1YYr2BZpaCAXiQp",
};

export const nav = [
  { label: "The floor", href: "#floor" },
  { label: "Plans", href: "#plans" },
  { label: "Hours", href: "#hours" },
  { label: "Find us", href: "#visit" },
];

export const hero = {
  // Keep in step with the hours below.
  openingLine: "Open 5–10 AM and 4–10 PM.",
  headline: "Paradise is earned.",
  sub: "Every body starts somewhere. Usually on a Monday, sore in places you didn't know had muscles.",
  primaryCta: { label: "Start here", href: "#plans" },
  secondaryCta: { label: "Member sign in", href: "/sign-in" },
};

export const statement = {
  lineOne: "We can't sell you discipline.",
  lineTwo: "We do have a lot of dumbbells.",
};

export const floor = {
  heading: "Iron, rubber mats, and people who show up.",
  body: [
    "No juice bar. No neon. Racks, plates, machines that work, and trainers who will fix your deadlift whether you asked or not.",
    "Come in your oldest T-shirt. Nobody here is looking.",
  ],
};

export const arc = {
  caption: "Your training arc. Results may vary. Soreness will not.",
  heading: "It goes roughly like this.",
  steps: [
    {
      when: "Week 1",
      what: "Everything hurts. You pretend to know where the leg press is.",
    },
    {
      when: "Month 2",
      what: "You stop watching what the guy next to you lifts. Mostly.",
    },
    {
      when: "Month 6",
      what: "A new member asks you for a spot. You say yes before you think about it.",
    },
    {
      when: "Year 1",
      what: "The gym shuts for a holiday and you're honestly a bit annoyed.",
    },
  ] satisfies ArcStep[],
};

export const facilities = {
  heading: "Enough kit that you won't wait long.",
  // PLACEHOLDER: confirm the equipment list with the owner.
  items: [
    {
      name: "Free weights",
      detail: "Dumbbells, barbells and plates. Re-rack them, please.",
    },
    {
      name: "Power racks",
      detail: "Squat and bench stations with proper safeties.",
    },
    {
      name: "Machines",
      detail:
        "Cables, leg press and the usual suspects for every muscle group.",
    },
    {
      name: "Cardio",
      detail:
        "Treadmills and bikes for warm-ups, or for people who enjoy that.",
    },
    {
      name: "Trainers",
      detail:
        "On the floor during open hours. Ask anything, including the embarrassing stuff.",
    },
    {
      name: "Lockers",
      detail: "Changing rooms and lockers. Bring a lock.",
    },
  ] satisfies Facility[],
};

export const plans = {
  heading: "Pick a length. Show up.",
  sub: "Longer plans work out cheaper per month. Ask at the desk or tap a plan to ask on WhatsApp.",
  // PLACEHOLDER: confirm which plan lengths the gym offers.
  items: [
    { name: "Monthly", months: 1, note: "Try it out" },
    {
      name: "Quarterly",
      months: 3,
      note: "What most people pick",
      featured: true,
    },
    { name: "Half-yearly", months: 6, note: "Past the hard part" },
    { name: "Yearly", months: 12, note: "For the stubborn" },
  ] satisfies Plan[],
  footnote: "Pay at the desk by cash or UPI.",
};

export const hours = {
  heading: "When the doors are open.",
  // From the owner, 2026-11-16.
  rows: [
    { days: "Morning", slots: ["5:00 AM – 10:00 AM"] },
    { days: "Evening", slots: ["4:00 PM – 10:00 PM"] },
  ] satisfies HoursRow[],
};

export const visit = {
  heading: "Come by. Look around.",
  sub: "Ask the desk anything. Decide after.",
};

export const finalCta = {
  heading: "Your first rep is the worst one.",
  sub: "It gets better around rep two thousand.",
  whatsappMessage: "Hi! I'd like to know more about joining Iron Paradise.",
};

export function whatsappLink(message: string): string {
  return `https://wa.me/${contact.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export function planEnquiry(plan: Plan): string {
  return whatsappLink(
    `Hi! I'd like to join Iron Paradise on the ${plan.name} plan.`,
  );
}
