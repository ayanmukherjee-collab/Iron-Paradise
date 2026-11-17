import { useEffect, useState, type ReactNode } from "react";
import { useRefreshKey } from "./refresh";

type LoadState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

/**
 * Loads a screen's data from the database, and loads it again after every
 * save (refreshData) or when `deps` change. The old data stays on screen
 * while a refresh is under way, so the page doesn't flash.
 */
export function useLoad<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
): LoadState<T> {
  const refreshKey = useRefreshKey();
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => {
        if (!cancelled) setState({ status: "ready", data });
      },
      (error: unknown) => {
        if (cancelled) return;
        console.error(error);
        setState({
          status: "error",
          message:
            error instanceof Error && error.message
              ? error.message
              : "Couldn't load this.",
        });
      },
    );
    return () => {
      cancelled = true;
    };
    // load is a fresh closure every render; deps say when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, ...deps]);

  return state;
}

/** Renders a screen once its data has loaded. */
export function Loaded<T>({
  state,
  children,
}: {
  state: LoadState<T>;
  children: (data: T) => ReactNode;
}) {
  if (state.status === "loading") {
    return (
      <p role="status" className="text-muted">
        Loading…
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="callout">
        Couldn&apos;t load this. Check your connection and try again.
      </p>
    );
  }
  return children(state.data);
}

/** Sets the browser tab's title, as Next.js metadata did. */
export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} | Iron Paradise` : "Iron Paradise";
  }, [title]);
}
