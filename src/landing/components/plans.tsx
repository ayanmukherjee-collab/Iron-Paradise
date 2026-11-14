import { planEnquiry, plans, type Plan } from "@/content/landing";
import { formatPaise } from "@/lib/money";
import { ButtonLink } from "./button-link";

export function Plans() {
  return (
    <section
      id="plans"
      className="mx-auto max-w-6xl scroll-mt-6 px-4 py-16 md:px-8 md:py-24"
    >
      <div className="md:flex md:items-end md:justify-between md:gap-10">
        <div>
          <p className="eyebrow text-smoke">{plans.eyebrow}</p>
          <h2 className="mt-3 display text-[clamp(2.4rem,10vw,4.5rem)]">
            {plans.heading}
          </h2>
        </div>
        <p className="mt-4 max-w-sm text-lg leading-snug text-ash md:mt-0">
          {plans.sub}
        </p>
      </div>

      <ul
        aria-label="Membership plans"
        className="-mx-4 mt-10 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-4"
      >
        {plans.items.map((plan) => (
          <PlanCard key={plan.name} plan={plan} />
        ))}
      </ul>
    </section>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const featured = plan.featured ?? false;
  const perMonth = Math.round(plan.pricePaise / plan.months / 100) * 100;

  return (
    <li
      className={`flex w-[80%] shrink-0 snap-start flex-col rounded-3xl p-6 sm:w-auto ${
        featured ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-ink/10"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-2xl tracking-wide uppercase">
          {plan.name}
        </h3>
        {featured ? (
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink">
            Popular
          </span>
        ) : null}
      </div>
      <p className={`mt-1 text-sm ${featured ? "text-mist" : "text-smoke"}`}>
        {plan.note}
      </p>

      <p className="mt-8 display text-6xl tabular-nums">
        {formatPaise(plan.pricePaise)}
      </p>
      <p className={`mt-2 text-sm ${featured ? "text-mist" : "text-smoke"}`}>
        {plan.months === 1
          ? "per month"
          : `for ${plan.months} months · about ${formatPaise(perMonth)} a month`}
      </p>

      <ButtonLink
        href={planEnquiry(plan)}
        variant={featured ? "light" : "outline-dark"}
        className="mt-8 w-full"
      >
        {plans.ctaLabel}
      </ButtonLink>
    </li>
  );
}
