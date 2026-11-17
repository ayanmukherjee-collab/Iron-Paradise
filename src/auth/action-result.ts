/**
 * What a save returns to the form that sent it: its data, or a message for
 * the person. Saves come from web/src/actions (the browser's guardedAction).
 */
export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: string };
