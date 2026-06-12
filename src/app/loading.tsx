import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <section className="grid gap-8" aria-busy="true" aria-live="polite">
      <div className="grid gap-4 border-b border-[var(--color-border)] pb-8">
        <div className="h-4 w-28 animate-pulse rounded-full bg-[var(--color-border)]" />
        <div className="grid gap-4 md:grid-cols-[1fr_22rem] md:items-end">
          <div className="grid gap-3">
            <div className="h-10 w-full max-w-xl animate-pulse rounded-full bg-[var(--color-border)]" />
            <div className="h-10 w-3/4 max-w-lg animate-pulse rounded-full bg-[var(--color-border)]" />
          </div>
          <div className="grid gap-3 md:justify-items-end">
            <div className="h-5 w-full max-w-sm animate-pulse rounded-full bg-[var(--color-border)]" />
            <div className="h-10 w-32 animate-pulse rounded-lg bg-[var(--color-border)]" />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            className="grid gap-3 border border-[var(--color-border)] bg-[var(--color-panel)] p-4 shadow-sm"
            key={item}
          >
            <div className="h-8 w-16 animate-pulse rounded-full bg-[var(--color-border)]" />
            <div className="h-4 w-24 animate-pulse rounded-full bg-[var(--color-border)]" />
          </div>
        ))}
      </div>

      <div className="grid min-h-48 place-items-center border border-dashed border-[var(--color-border)] bg-[var(--color-panel)] p-8">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-muted)]">
          <Loader2 aria-hidden="true" className="animate-spin" size={17} />
          Loading dashboard
        </div>
      </div>
    </section>
  );
}
