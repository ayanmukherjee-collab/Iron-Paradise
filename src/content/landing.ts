/**
 * Everything the public landing page says lives here, so the owner can change
 * text, prices, hours and contact details without touching any component.
 *
 * Values marked PLACEHOLDER are stand-ins until the owner confirms the real
 * ones. Prices are integer paise (₹1 = 100 paise), matching how the app stores
 * money everywhere else.
 */

export type Plan = {
  name: string;
  months: number;
  pricePaise: number;
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

export const gym = {
  name: "Iron Paradise",
  fullName: "Iron Paradise Gym",
  description:
    "A no-nonsense strength gym. Free weights, racks, machines and trainers on the floor. Plans, hours and directions inside.",
};

export const contact = {
  // PLACEHOLDER: real phone, WhatsApp number, address and map link from the owner.
  phoneDisplay: "+91 00000 00000",
  phoneHref: "tel:+910000000000",
  whatsappNumber: "910000000000",
  addressLines: ["Street address", "Area, City 000000"],
  mapsUrl: "https://maps.google.com/?q=Iron+Paradise+Gym",
  instagramHandle: "ironparadise.gym",
};

export const nav = [
  { label: "The floor", href: "#floor" },
  { label: "Plans", href: "#plans" },
  { label: "Hours", href: "#hours" },
  { label: "Find us", href: "#visit" },
];

export const hero = {
  kicker: "Strength & conditioning",
  // The leading "P" is drawn by the logo mark, so the first line starts at "aradise".
  headlineAfterMark: "aradise",
  headlineSecondLine: "is earned.",
  headlineSpoken: "Paradise is earned.",
  sub: "Every body starts somewhere. Usually on a Monday, sore in places you didn't know had muscles.",
  primaryCta: { label: "Start here", href: "#plans" },
  secondaryCta: { label: "Member sign in", href: "/sign-in" },
};

export const statement = {
  lineOne: "We can't sell you discipline.",
  lineTwo: "We do have a lot of dumbbells.",
};

export const floor = {
  eyebrow: "The floor",
  heading: "Iron, rubber mats, and people who show up.",
  body: [
    "No juice bar. No neon. Racks, plates, machines that work, and trainers who will fix your deadlift whether you asked or not.",
    "Come in your oldest T-shirt. Nobody here is looking.",
  ],
};

export const arc = {
  eyebrow: "Your training arc",
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
  eyebrow: "What's on the floor",
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
  eyebrow: "Plans",
  heading: "Pick a length. Show up.",
  sub: "Pay at the desk by cash or UPI. Longer plans cost less per month.",
  // PLACEHOLDER: real plans and prices from the owner.
  items: [
    { name: "Monthly", months: 1, pricePaise: 120000, note: "Try it out" },
    {
      name: "Quarterly",
      months: 3,
      pricePaise: 330000,
      note: "What most people pick",
      featured: true,
    },
    {
      name: "Half-yearly",
      months: 6,
      pricePaise: 600000,
      note: "Past the hard part",
    },
    {
      name: "Yearly",
      months: 12,
      pricePaise: 1080000,
      note: "For the stubborn",
    },
  ] satisfies Plan[],
  ctaLabel: "Ask on WhatsApp",
};

export const hours = {
  eyebrow: "Hours",
  heading: "When the doors are open.",
  // PLACEHOLDER: real timings from the owner.
  rows: [
    {
      days: "Monday to Saturday",
      slots: ["5:30 AM – 10:30 AM", "4:30 PM – 10:00 PM"],
    },
    { days: "Sunday", slots: ["7:00 AM – 11:00 AM"] },
  ] satisfies HoursRow[],
  note: "Last entry 30 minutes before closing.",
};

export const visit = {
  eyebrow: "Find us",
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
