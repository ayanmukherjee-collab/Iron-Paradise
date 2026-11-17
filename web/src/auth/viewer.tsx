import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Navigate, useLocation } from "react-router";
import type { Action, Role } from "@/auth/permissions";
import { viewerCan, type Viewer } from "@/auth/viewer";
import { supabase } from "../lib/supabase";

export { viewerCan, type Viewer };

type ViewerState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "ready"; viewer: Viewer }
  | { status: "error" };

const ViewerContext = createContext<ViewerState>({ status: "loading" });

// The same viewer, for code outside React (guarded actions, data loaders).
let latest: Viewer | null = null;

/** The signed-in viewer right now, or null. */
export function currentViewer(): Viewer | null {
  return latest;
}

/**
 * Who is signed in, read once per sign-in. The role comes from the profiles
 * table, never from the token, as on the server (src/auth/session.ts). Screens
 * only use it to decide what to offer: the database still checks every read
 * and save against the signed-in user.
 */
export function ViewerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ViewerState>({ status: "loading" });
  useEffect(() => {
    latest = state.status === "ready" ? state.viewer : null;
  }, [state]);

  useEffect(() => {
    let current: string | null | undefined;
    let cancelled = false;

    async function load(session: Session | null) {
      const userId = session?.user.id ?? null;
      if (userId === current) return;
      current = userId;
      if (!userId) {
        setState({ status: "signed-out" });
        return;
      }
      setState({ status: "loading" });
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, role, is_active")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled || current !== userId) return;
      if (error) setState({ status: "error" });
      else if (!data) setState({ status: "signed-out" });
      else
        setState({
          status: "ready",
          viewer: {
            userId,
            fullName: data.full_name,
            email: data.email,
            role: data.role as Role,
            isActive: data.is_active,
          },
        });
    }

    // Fires once at start with the stored session, then on every change.
    // Supabase warns against awaiting its own calls inside this callback,
    // so the profile read runs just after it returns.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => void load(session), 0);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <ViewerContext.Provider value={state}>{children}</ViewerContext.Provider>
  );
}

export function useViewerState(): ViewerState {
  return useContext(ViewerContext);
}

/** The signed-in viewer; only call inside <RequireViewer>. */
export function useViewer(): Viewer {
  const state = useViewerState();
  if (state.status !== "ready") throw new Error("No viewer yet");
  return state.viewer;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  // A full reload, so nothing the last person saw stays in memory.
  window.location.assign("/sign-in");
}

/** Sends signed-out visitors to sign in, then back here. */
export function RequireViewer({ children }: { children: ReactNode }) {
  const state = useViewerState();
  const location = useLocation();
  if (state.status === "loading") {
    return (
      <p role="status" className="sr-only">
        Loading…
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="m-4 callout text-lg">
        Couldn&apos;t reach the gym&apos;s database. Check your connection and
        reload.
      </p>
    );
  }
  if (state.status === "signed-out") {
    const next = location.pathname + location.search;
    return (
      <Navigate to={`/sign-in?next=${encodeURIComponent(next)}`} replace />
    );
  }
  return children;
}

/** Inside RequireViewer: people without the permission go home. */
export function RequirePermission({
  action,
  children,
}: {
  action: Action;
  children: ReactNode;
}) {
  const viewer = useViewer();
  if (!viewerCan(viewer, action)) return <Navigate to="/app" replace />;
  return children;
}
