import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Navigate, useLocation } from "react-router";
import { can, type Action, type Role } from "@/auth/permissions";
import { supabase } from "../lib/supabase";

export interface Viewer {
  userId: string;
  fullName: string;
  email: string | null;
  role: Role;
  isActive: boolean;
}

type ViewerState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "ready"; viewer: Viewer }
  | { status: "error" };

const ViewerContext = createContext<ViewerState>({ status: "loading" });

/**
 * Who is signed in, read once per sign-in. The role comes from the profiles
 * table, never from the token, as on the server (src/auth/session.ts). Screens
 * only use it to decide what to offer: the database still checks every read
 * and save against the signed-in user.
 */
export function ViewerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ViewerState>({ status: "loading" });

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

export function viewerCan(viewer: Viewer | null, action: Action): boolean {
  return viewer !== null && viewer.isActive && can(viewer.role, action);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  // A full reload, so nothing the last person saw stays in memory.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
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
