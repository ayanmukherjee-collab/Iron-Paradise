import { useSyncExternalStore } from "react";

// Stands in for Next.js's router.refresh(): after a save, every screen that
// reads data with useRefreshKey() fetches again.
let version = 0;
const listeners = new Set<() => void>();

export function refreshData(): void {
  version += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Changes whenever refreshData() runs; put it in a data effect's deps. */
export function useRefreshKey(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
}
