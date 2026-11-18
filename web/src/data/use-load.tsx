import { useEffect, useState, type ReactNode } from "react";
import { currentRefreshVersion, useRefreshKey } from "./refresh";

type LoadState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

// The last data each screen showed, so opening it again draws at once while
// the fresh copy loads behind it. An entry only counts until the next save
// (refreshData), so nothing from before your own change is ever shown, and
// a sign-out reloads the page, which empties it.
const remembered = new Map<string, { version: number; data: unknown }>();
const rememberAtMost = 40;

function recall<T>(key: string | null): T | undefined {
  if (key === null) return undefined;
  const entry = remembered.get(key);
  return entry && entry.version === currentRefreshVersion()
    ? (entry.data as T)
    : undefined;
}

function remember(key: string, data: unknown) {
  remembered.delete(key);
  remembered.set(key, { version: currentRefreshVersion(), data });
  // Oldest first in a Map: drop from the front.
  while (remembered.size > rememberAtMost) {
    remembered.delete(remembered.keys().next().value!);
  }
}

/**
 * Loads a screen's data from the database, and loads it again after every
 * save (refreshData) or when `deps` change. The old data stays on screen
 * while a refresh is under way, so the page doesn't flash. With a `cacheKey`,
 * a screen opened before shows its last data straight away and refreshes.
 */
export function useLoad<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
  cacheKey?: string,
): LoadState<T> {
  const refreshKey = useRefreshKey();
  const key = cacheKey ? `${cacheKey}:${JSON.stringify(deps)}` : null;
  const initial = (): LoadState<T> => {
    const cached = recall<T>(key);
    return cached === undefined
      ? { status: "loading" }
      : { status: "ready", data: cached };
  };
  const [state, setState] = useState<LoadState<T>>(initial);
  // A different item on the same screen (another member, say): show what we
  // remember of it, or nothing, rather than the previous one.
  const [shownKey, setShownKey] = useState(key);
  if (shownKey !== key) {
    setShownKey(key);
    setState(initial());
  }

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => {
        if (cancelled) return;
        if (key !== null) remember(key, data);
        setState({ status: "ready", data });
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
  }, [refreshKey, key, ...deps]);

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
