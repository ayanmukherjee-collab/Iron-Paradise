import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { dataOf } from "./action";

export { supabase };

/**
 * A table query, untyped. Without generated database types supabase-js
 * guesses row shapes from select strings (and types embedded one-to-one rows
 * as lists); each caller casts to the shape it selects instead.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function table(name: string): any {
  return supabase.from(name);
}

/** Supabase's Data API returns at most this many rows per request. */
const pageSize = 1000;

interface Ranged<T> {
  range(
    from: number,
    to: number,
  ): PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;
}

/**
 * Every row a query matches, fetched a page at a time. The Data API caps a
 * response at 1,000 rows; lists that can grow past that (fees, freezes,
 * memberships) go through here so nothing is silently cut off. `make` must
 * build the query afresh each call and give it a stable order.
 */
export async function allRows<T>(make: () => Ranged<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = dataOf<T[]>(await make().range(from, from + pageSize - 1));
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

/** Calls a database function and returns its result, or throws a Refusal. */
export async function rpc<T>(
  name: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return dataOf<T>(await supabase.rpc(name, args));
}

/** Timestamps arrive as ISO strings; the shared code expects Dates. */
export function date(value: string): Date;
export function date(value: string | null): Date | null;
export function date(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

/** Groups rows into lists by a key, keeping their order. */
export function groupBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const grouped = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = grouped.get(k);
    if (list) list.push(row);
    else grouped.set(k, [row]);
  }
  return grouped;
}
