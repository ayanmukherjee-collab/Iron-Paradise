// Rendered to HTML at build time by web/prerender.mjs, so the public pages
// (landing, privacy, terms) arrive as finished HTML: search engines and
// slow phones see them without running any JavaScript.
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { LandingPage, PrivacyPage, TermsPage } from "./pages/site";

export const pages = {
  "/": () => <LandingPage />,
  "/privacy": () => <PrivacyPage />,
  "/terms": () => <TermsPage />,
} as const;

export function render(path: keyof typeof pages): string {
  const Page = pages[path];
  return renderToString(
    <MemoryRouter initialEntries={[path]}>
      <Page />
    </MemoryRouter>,
  );
}
