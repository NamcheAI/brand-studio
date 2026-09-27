import { cloneDocument, type Document } from './model';

const MAX_HISTORY = 50;

export type HistoryState = {
  past: Document[];
  present: Document;
  future: Document[];
};

export function createHistory(present: Document): HistoryState {
  return { past: [], present, future: [] };
}

export function pushHistory(state: HistoryState, next: Document): HistoryState {
  const present = cloneDocument(next);
  const past = [...state.past, cloneDocument(state.present)];
  if (past.length > MAX_HISTORY) past.shift();
  return { past, present, future: [] };
}

/** Update present without adding a history entry (used while scrubbing sliders). */
export function replacePresent(state: HistoryState, next: Document): HistoryState {
  return { ...state, present: cloneDocument(next) };
}

export function undoHistory(state: HistoryState): HistoryState {
  if (!state.past.length) return state;
  const previous = state.past[state.past.length - 1];
  return {
    past: state.past.slice(0, -1),
    present: cloneDocument(previous),
    future: [cloneDocument(state.present), ...state.future],
  };
}

export function redoHistory(state: HistoryState): HistoryState {
  if (!state.future.length) return state;
  const next = state.future[0];
  return {
    past: [...state.past, cloneDocument(state.present)],
    present: cloneDocument(next),
    future: state.future.slice(1),
  };
}

export function canUndo(state: HistoryState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: HistoryState): boolean {
  return state.future.length > 0;
}
