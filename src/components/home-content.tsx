"use client";

import { useLanguage } from "@/components/language-provider";

export function HomeContent() {
  const { messages } = useLanguage();
  const stats = [
    { label: messages.home.stats.papers, value: "0" },
    { label: messages.home.stats.repositories, value: "0" },
    { label: messages.home.stats.notes, value: "0" },
  ];
  const sections = [
    messages.home.sections.intake,
    messages.home.sections.summaries,
    messages.home.sections.export,
  ];

  return (
    <section className="grid gap-8" id="today">
      <div className="grid gap-4 border-b border-[var(--color-border)] pb-8">
        <p className="text-sm font-medium text-[var(--color-muted)]">{messages.home.eyebrow}</p>
        <div className="grid gap-3 md:grid-cols-[1fr_22rem] md:items-end">
          <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
            {messages.home.title}
          </h1>
          <p className="text-base leading-7 text-[var(--color-muted)]">{messages.home.summary}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            className="border border-[var(--color-border)] bg-[var(--color-panel)] p-4 shadow-sm"
            key={stat.label}
          >
            <p className="text-3xl font-semibold">{stat.value}</p>
            <p className="mt-2 text-sm font-medium text-[var(--color-muted)]">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3" id="library">
        {sections.map((section) => (
          <div
            className="min-h-32 border border-[var(--color-border)] bg-[var(--color-panel)] p-4"
            key={section}
          >
            <h2 className="text-base font-semibold">{section}</h2>
          </div>
        ))}
      </div>

      <div className="sr-only" id="exports" />
    </section>
  );
}
