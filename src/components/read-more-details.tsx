"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

export function ReadMoreDetails({
  children,
  title = "Detailed Analysis",
}: Readonly<{
  children: React.ReactNode;
  title?: string;
}>) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  return (
    <section className="grid gap-3 border-t border-[var(--color-border)] pt-4">
      <button
        aria-controls={contentId}
        aria-expanded={expanded}
        className="inline-flex min-h-10 w-fit items-center gap-2 border border-[var(--color-border)] px-3 py-2 text-sm font-semibold transition hover:border-[var(--color-accent)]"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <ChevronDown
          aria-hidden="true"
          className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          size={16}
        />
        {expanded ? "Show Less" : "Read More"}
      </button>

      {expanded ? (
        <div
          className="grid gap-4 bg-[var(--color-surface)] p-4 leading-7"
          id={contentId}
          role="region"
          aria-label={title}
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}
