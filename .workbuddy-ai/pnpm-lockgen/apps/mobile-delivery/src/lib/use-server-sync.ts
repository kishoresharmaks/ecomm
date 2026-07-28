import { useEffect, useRef } from "react";

/**
 * Applies a server-derived value to local form state only when the server
 * value itself changes. Background refetches that return unchanged data will
 * never clobber in-progress edits, while genuine server updates (a save, an
 * assignment change) still flow into the form.
 *
 * `serverValue` must be JSON-serializable; pass `ready: false` until the
 * source query has data.
 */
export function useServerSync<T>(serverValue: T, apply: (value: T) => void, ready: boolean) {
  const appliedKeyRef = useRef<string | null>(null);
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const key = JSON.stringify(serverValue ?? null);

  useEffect(() => {
    if (!ready || appliedKeyRef.current === key) return;
    appliedKeyRef.current = key;
    applyRef.current(serverValue);
  }, [key, ready]);
}
