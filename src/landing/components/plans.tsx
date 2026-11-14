import { planEnquiry, plans, type Plan } from "@/content/landing";

/** A board of plan lengths, like the one taped up at the desk. No prices online. */
export function Plans() {
  return (
    <section
      id="plans"
      className="mx-auto max-w-6xl scroll-mt-6 px-4 pb-16 md:px-8 md:pb-24"
    >
      <div className="grid gap-4 md:grid-cols-12 md:items-end md:gap-10">
        <h2 className="display text-[clamp(2.6rem,11vw,5rem)] md:col-span-7">
          {plans.heading}
        </h2>
        <p className="max-w-sm text-lg leading-snug text-ash md:col-span-5">
          {plans.sub}
        </p>
      </div>

      <ul aria-label="Membership plans" className="mt-8 border-t-4 border-ink">
        {plans.items.map((plan) => (
          <PlanRow key={plan.name} plan={plan} />
        ))}
      </ul>
      <p className="mt-4 text-sm text-smoke">{plans.footnote}</p>
    </section>
  );
}

function PlanRow({ plan }: { plan: Plan }) {
  const featured = plan.featured ?? false;

  return (
    <li className="border-b-2 border-ink">
      <a
        href={planEnquiry(plan)}
        target="_blank"
        rel="noopener noreferrer"
        className={`group grid grid-cols-[1fr_auto] items-end gap-x-4 gap-y-1 px-3 py-5 transition-colors duration-150 md:grid-cols-[14rem_1fr_auto] md:items-center md:px-5 md:py-6 ${
          featured ? "bg-ink text-white" : "hover:bg-white"
        }`}
      >
        <span className="font-display text-3xl uppercase md:text-4xl">
          {plan.name}
        </span>
        <span
          className={`row-start-2 text-sm md:col-start-2 md:row-start-1 md:text-base ${
            featured ? "text-mist" : "text-smoke group-hover:text-ash"
          }`}
        >
          {plan.note}
          <span className="mt-1 block font-semibold underline decoration-1 underline-offset-4 md:mt-0 md:ml-4 md:inline">
            Ask on WhatsApp
          </span>
        </span>
        <span className="row-span-2 flex items-baseline gap-2 self-center justify-self-end md:row-span-1">
          <span className="display text-[clamp(2.6rem,11vw,4rem)] tabular-nums">
            {plan.months}
          </span>
          <span className="text-sm font-semibold uppercase">
            {plan.months === 1 ? "month" : "months"}
          </span>
        </span>
      </a>
    </li>
  );
}
