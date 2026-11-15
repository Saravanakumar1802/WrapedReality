import { useEffect, useState } from "react";

/** @type {Promise<any> | null} */
let request = null;

/** Loads public/data/moments.json once per visit (it is only needed once someone searches). */
export function loadMomentIndex() {
  request ??= fetch("/data/moments.json")
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => {
      request = null;
      return null;
    });
  return request;
}

/**
 * The moment index, or null while loading / when there isn't one yet.
 * @returns {{ index: { model: string | null, dim: number, games: string[], items: any[] } | null, loading: boolean }}
 */
export function useMomentIndex(enabled = true) {
  const [state, setState] = useState({ index: null, loading: enabled });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadMomentIndex().then((index) => alive && setState({ index, loading: false }));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return state;
}
