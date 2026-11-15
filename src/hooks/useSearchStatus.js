import { useSyncExternalStore } from "react";
import { onSearchStatus } from "@/lib/semanticSearch.js";

let snapshot = { status: "idle", progress: 0 };
const subscribe = (notify) =>
  onSearchStatus((s) => {
    snapshot = s;
    notify();
  });

/** The in-browser AI model's status: "idle" | "loading" (with progress %) | "ready" | "unavailable". */
export function useSearchStatus() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}
