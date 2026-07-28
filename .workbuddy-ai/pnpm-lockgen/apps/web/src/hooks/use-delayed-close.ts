"use client";

import { useCallback, useEffect, useRef } from "react";

export function useDelayedClose(
  onClose: () => void,
  resetKey: unknown,
  delayMs = 1500,
) {
  const timerRef = useRef<number | null>(null);

  const cancelPendingClose = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    cancelPendingClose();
    return cancelPendingClose;
  }, [cancelPendingClose, resetKey]);

  return useCallback(() => {
    cancelPendingClose();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onClose();
    }, delayMs);
  }, [cancelPendingClose, delayMs, onClose]);
}
