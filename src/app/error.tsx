"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("dashboard render failed", error);
  }, [error]);

  return (
    <section className="grid min-h-[60vh] place-items-center p-6">
      <div className="grid max-w-lg gap-4 border border-[var(--color-border)] bg-[var(--color-panel)] p-6 text-center shadow-sm">
        <AlertTriangle
          aria-hidden="true"
          className="mx-auto text-red-700 dark:text-red-300"
          size={34}
          strokeWidth={1.8}
        />
        <div className="grid gap-2">
          <h1 className="text-2xl font-semibold">Dashboard unavailable</h1>
          <p className="text-sm leading-6 text-[var(--color-muted)]">
            The latest papers and repositories could not be loaded.
          </p>
        </div>
        <button
          className="mx-auto inline-flex min-h-10 items-center justify-center gap-2 border border-[var(--color-border)] px-4 py-2 text-sm font-semibold transition hover:border-[var(--color-accent)]"
          onClick={reset}
          type="button"
        >
          <RefreshCcw aria-hidden="true" size={16} />
          Retry
        </button>
      </div>
    </section>
  );
}
