"use client";

import { useRef, useState } from "react";

/** Keep failed actions retryable and prevent duplicate submissions. */
export const useAsyncAction = () => {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (operation: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try { await operation(); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your changes. Please try again.");
    } finally { locked.current = false; setBusy(false); }
  };
  return { run, busy, error, clearError: () => setError("") };
};
