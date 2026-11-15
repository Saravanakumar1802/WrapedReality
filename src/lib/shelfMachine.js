/**
 * The shelf's interaction state, as a pure reducer (no React, no three.js), so
 * every transition is unit-tested.
 *
 *   browsing ──select──▶ out ──advance──▶ open ──advance──▶ inspect
 *       ▲                 │◀────back──────┘◀─────back────────┘
 *       └──── close / back from "out" (the case flies home: `leaving`) ────┘
 *
 * `leaving` holds cases that are still flying back to their slot. Selecting a
 * neighbour while one case is out sends the old case home and pulls the new one
 * out at the same time, so browsing case to case never stops on an empty shelf.
 */

export const STAGES = /** @type {const} */ (["out", "open", "inspect"]);

/**
 * @typedef {{ selected: string | null, stage: "out" | "open" | "inspect", leaving: string[], focused: string | null }} ShelfState
 * @typedef {{ type: "select", slug: string }
 *   | { type: "advance" } | { type: "back" } | { type: "close" } | { type: "toggleCase" }
 *   | { type: "goto", stage: "out" | "open" | "inspect" }
 *   | { type: "step", dir: 1 | -1, order: string[] }
 *   | { type: "focus", slug: string | null }
 *   | { type: "returned", slug: string }
 *   | { type: "reset" }} ShelfAction
 */

/** @type {ShelfState} */
export const initialShelfState = Object.freeze({ selected: null, stage: "out", leaving: [], focused: null });

const without = (list, slug) => list.filter((s) => s !== slug);

/** Puts the selected case back (it joins `leaving` until its flight home ends). */
function close(state) {
  if (!state.selected) return state;
  return { ...state, selected: null, stage: "out", leaving: [...without(state.leaving, state.selected), state.selected] };
}

/**
 * @param {ShelfState} state
 * @param {ShelfAction} action
 * @returns {ShelfState}
 */
export function shelfReducer(state, action) {
  switch (action.type) {
    case "select": {
      if (state.selected === action.slug) return state;
      const leaving = state.selected ? [...without(state.leaving, state.selected), state.selected] : state.leaving;
      return { selected: action.slug, stage: "out", leaving: without(leaving, action.slug), focused: action.slug };
    }
    case "advance": {
      if (!state.selected) return state;
      const i = STAGES.indexOf(state.stage);
      return i < STAGES.length - 1 ? { ...state, stage: STAGES[i + 1] } : state;
    }
    case "goto":
      return state.selected && STAGES.includes(action.stage) && state.stage !== action.stage ? { ...state, stage: action.stage } : state;
    case "toggleCase":
      if (!state.selected) return state;
      return { ...state, stage: state.stage === "out" ? "open" : "out" };
    case "back": {
      if (!state.selected) return state;
      if (state.stage === "inspect") return { ...state, stage: "open" };
      if (state.stage === "open") return { ...state, stage: "out" };
      return close(state);
    }
    case "close":
      return close(state);
    case "step": {
      const { order, dir } = action;
      if (!order.length) return state;
      const from = state.selected ?? state.focused;
      const i = from ? order.indexOf(from) : -1;
      const next = order[i === -1 ? 0 : Math.max(0, Math.min(order.length - 1, i + dir))];
      if (state.selected) return next === state.selected ? state : shelfReducer(state, { type: "select", slug: next });
      return next === state.focused ? state : { ...state, focused: next };
    }
    case "focus":
      return state.focused === action.slug ? state : { ...state, focused: action.slug };
    case "returned":
      return state.leaving.includes(action.slug) ? { ...state, leaving: without(state.leaving, action.slug) } : state;
    case "reset":
      return initialShelfState;
    default:
      return state;
  }
}

/** Neighbours of the selected case in visual order (for the prev/next controls). */
export function neighbours(order, slug) {
  const i = slug ? order.indexOf(slug) : -1;
  if (i === -1) return { prev: null, next: null, index: -1 };
  return { prev: order[i - 1] ?? null, next: order[i + 1] ?? null, index: i };
}
