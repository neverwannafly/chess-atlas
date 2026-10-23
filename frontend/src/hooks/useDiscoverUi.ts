import { useSyncExternalStore } from "react";

/** Tiny shared UI state between the Discover page and the global header (docked search, filter sheet). */
interface UiState {
  docked: boolean;
  sheetOpen: boolean;
  /** Bumped when something asks for the search field to take focus. */
  focusTick: number;
}

let state: UiState = { docked: false, sheetOpen: false, focusTick: 0 };
const subs = new Set<() => void>();

export function setUi(patch: Partial<UiState>) {
  const next = { ...state, ...patch };
  if (next.docked === state.docked && next.sheetOpen === state.sheetOpen && next.focusTick === state.focusTick) return;
  state = next;
  subs.forEach((f) => f());
}
export const requestSearchFocus = () => setUi({ focusTick: state.focusTick + 1 });
export const getUi = () => state;

export function useUi<T>(select: (s: UiState) => T): T {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => subs.delete(f); },
    () => select(state),
    () => select(state)
  );
}
