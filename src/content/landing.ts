/**
 * Everything the public landing page says lives here, so the owner can change
 * text, plans, hours and contact details without touching any component.
 *
 * The page is built to be read in pictures first: every block has an icon or
 * a big number, and words are kept to a label or a short line. Keep it that
 * way when editing: one or two words per label.
 *
 * Values marked PLACEHOLDER are stand-ins until the owner confirms the real
 * ones. Prices are deliberately not published; plans point people to the desk
 * or WhatsApp instead.
 */

import type { LandingIcon } from "@/landing/components/icons";

export type Plan = {
  name: string;
  months: number;
  note: string;
  featured?: boolean;
};

export type Facility = {
  name: string;
  icon: LandingIcon;
};

export type HoursRow = {
  label: string;
  icon: LandingIcon;
  /** 24-hour clock, used to draw the day dial. */
  from: number;
  to: number;
  slot: string;
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
  closing: { file: "saitama", width: 960, height: 1406 },
} satisfies Record<string, Art>;

export const gym = {
  name: "Iron Paradise",
  fullName: "Iron Paradise Gym",
  description:
    "A no-nonsense strength gym in Bundu, Ranchi. Free weights, racks, machines and trainers on the floor. Hours, plans and directions inside.",
};

export const contact = {
  // The owner's number, for calls and WhatsApp (owner, 2026-11-16).
  phoneDisplay: "+91 87970 02647",
  phoneHref: "tel:+918797002647",
  whatsappNumber: "918797002647",
  addressLines: ["Near Bank of Baroda", "Bundu, Ranchi 835204", "Jharkhand"],
  mapsUrl: "https://maps.app.goo.gl/1S3FUJhDWSiPHZij7",
  /**
   * The gym's pin, from its Google Maps listing. After changing it, run
   * `npm run map` to redraw the map preview around the new spot.
   */
  location: { lat: 23.1740734, lng: 85.588648 },
  instagramHandle: "ip_fit_gym",
  whatsappCommunityUrl: "https://chat.whatsapp.com/C7rWOtn1YYr2BZpaCAXiQp",
};

export const nav = [
  { label: "Gym", href: "#gym", icon: "dumbbell" },
  { label: "Time", href: "#time", icon: "clock" },
  { label: "Plans", href: "#plans", icon: "calendar" },
  { label: "Map", href: "#map", icon: "pin" },
] satisfies { label: string; href: string; icon: LandingIcon }[];

export const hero = {
  word: "Iron",
  headline: "Paradise is earned.",
  sub: "Strength gym in Bundu. Open mornings and evenings, Monday to Saturday.",
};

/** The big picture buttons under the hero. Sign in comes first, always. */
export const quickActions = {
  signIn: { label: "Sign in", hint: "Members & staff", href: "/sign-in" },
  call: { label: "Call" },
  whatsapp: { label: "WhatsApp" },
  map: { label: "Map", href: "#map" },
};

export const facilities = {
  heading: "Inside the gym",
  // PLACEHOLDER: confirm the equipment list with the owner.
  items: [
    { name: "Dumbbells", icon: "dumbbell" },
    { name: "Squat racks", icon: "rack" },
    { name: "Machines", icon: "machine" },
    { name: "Cardio", icon: "treadmill" },
    { name: "Trainers", icon: "trainer" },
    { name: "Lockers", icon: "locker" },
  ] satisfies Facility[],
};

export const hours = {
  heading: "Open hours",
  sub: "Monday to Saturday. Closed on Sunday.",
  /** Days the doors stay shut, 0 = Sunday (owner, 2026-11-17). */
  closedDays: [0],
  // From the owner, 2026-11-16. Keep hero.sub in step.
  rows: [
    { label: "Morning", icon: "sun", from: 5, to: 10, slot: "5 – 10 AM" },
    { label: "Evening", icon: "moon", from: 16, to: 22, slot: "4 – 10 PM" },
  ] satisfies HoursRow[],
};

export const plans = {
  heading: "Plans",
  sub: "Pick a length. Ask the price at the desk or on WhatsApp.",
  // PLACEHOLDER: confirm which plan lengths the gym offers.
  items: [
    { name: "Monthly", months: 1, note: "Try it" },
    { name: "Quarterly", months: 3, note: "Most picked", featured: true },
    { name: "Half-yearly", months: 6, note: "Past the hard part" },
    { name: "Yearly", months: 12, note: "For the stubborn" },
  ] satisfies Plan[],
  footnote: "Pay at the desk by cash or UPI.",
};

export const visit = {
  heading: "Find us",
  mapCta: "Open in Google Maps",
};

export const finalCta = {
  heading: "Your first rep is the worst one.",
  sub: "Members and staff sign in here.",
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
