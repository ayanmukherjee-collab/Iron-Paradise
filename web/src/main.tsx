import "@fontsource/anton/400.css";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "@fontsource-variable/inter";
import "./app.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { AppShell, NotRebuiltYet } from "./app-shell";
import {
  RequirePermission,
  RequireViewer,
  ViewerProvider,
} from "./auth/viewer";
import { CheckInPage } from "./pages/check-in";
import { AuthCallbackPage, SignInPage } from "./pages/sign-in";

const router = createBrowserRouter([
  { path: "/sign-in", element: <SignInPage /> },
  { path: "/auth/callback", element: <AuthCallbackPage /> },
  {
    path: "/app",
    element: (
      <RequireViewer>
        <AppShell />
      </RequireViewer>
    ),
    children: [
      {
        path: "check-in",
        element: (
          <RequirePermission action="self.checkIn">
            <CheckInPage />
          </RequirePermission>
        ),
      },
      { path: "*", element: <NotRebuiltYet /> },
      { index: true, element: <NotRebuiltYet /> },
    ],
  },
  { path: "*", element: <Navigate to="/app" replace /> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ViewerProvider>
      <RouterProvider router={router} />
    </ViewerProvider>
  </StrictMode>,
);
