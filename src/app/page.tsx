import { Closing, Visit } from "@/landing/components/closing";
import { Hero } from "@/landing/components/hero";
import { Plans } from "@/landing/components/plans";
import {
  Facilities,
  Floor,
  Statement,
  TrainingArc,
} from "@/landing/components/sections";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <main>
        <Statement />
        <Floor />
        <TrainingArc />
        <Facilities />
        <Plans />
        <Visit />
      </main>
      <Closing />
    </>
  );
}
