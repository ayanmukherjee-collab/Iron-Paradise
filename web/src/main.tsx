import "@fontsource/anton/400.css";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "@fontsource-variable/inter";
import "./app.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { ViewerProvider } from "./auth/viewer";
import { registerServiceWorker } from "./pwa";
import { router } from "./routes";

const root = document.getElementById("root")!;
// Public pages arrive already written into the HTML (web/prerender.mjs) for
// search engines and a fast first paint. The app then renders over them with
// the same markup, which also brings "open now" up to the current time.
delete root.dataset.path;
createRoot(root).render(
  <StrictMode>
    <ViewerProvider>
      <RouterProvider router={router} />
    </ViewerProvider>
  </StrictMode>,
);

registerServiceWorker();
