"use client";

import { FileText } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { PaperCard } from "@/components/paper-card";
import { RepositoryCard } from "@/components/repository-card";
import type { DashboardData, DashboardDay } from "@/services/dashboard";

type HomeContentProps = {
  dashboard: DashboardData;
};

type ItemLanguage = "EN" | "ZH";

export function HomeContent({ dashboard }: HomeContentProps) {
  const { language, messages } = useLanguage();
  const itemLanguage: ItemLanguage = language === "zh" ? "ZH" : "EN";
  const totalItems = dashboard.stats.papers + dashboard.stats.repositories;
  const stats = [
    { label: messages.home.stats.papers, value: dashboard.stats.papers.toString() },
    { label: messages.home.stats.repositories, value: dashboard.stats.repositories.toString() },
    { label: messages.home.stats.notes, value: dashboard.stats.notes.toString() },
  ];

  return (
    <section className="grid gap-8" id="today">
      <div className="grid gap-4 border-b border-[var(--color-border)] pb-8">
        <p className="text-sm font-medium text-[var(--color-muted)]">{messages.home.eyebrow}</p>
        <div className="grid gap-3 md:grid-cols-[1fr_22rem] md:items-end">
          <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
            {messages.home.title}
          </h1>
          <p className="text-base leading-7 text-[var(--color-muted)]">
            {messages.home.summary(totalItems)}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3" aria-label={messages.home.statsLabel}>
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

      <div className="grid gap-8" id="library">
        {dashboard.days.length === 0 ? (
          <EmptyDashboard />
        ) : (
          dashboard.days.map((day) => (
            <DashboardDaySection day={day} itemLanguage={itemLanguage} key={day.date} />
          ))
        )}
      </div>

      <div className="sr-only" id="exports" />
    </section>
  );
}

function DashboardDaySection({
  day,
  itemLanguage,
}: {
  day: DashboardDay;
  itemLanguage: ItemLanguage;
}) {
  return (
    <section className="grid gap-5 border-t border-[var(--color-border)] pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-2xl font-semibold">{formatDayLabel(day.date)}</h2>
        <p className="text-sm font-medium text-[var(--color-muted)]">
          {day.papers.length + day.repositories.length} items
        </p>
      </div>

      <DailySection title="Daily Papers" count={day.papers.length}>
        {day.papers.length === 0 ? (
          <EmptySection label="No papers saved for this day." />
        ) : (
          <div className="grid gap-3">
            {day.papers.map((paper) => (
              <PaperCard itemLanguage={itemLanguage} key={paper.id} paper={paper} />
            ))}
          </div>
        )}
      </DailySection>

      <DailySection title="Daily GitHub Repositories" count={day.repositories.length}>
        {day.repositories.length === 0 ? (
          <EmptySection label="No repositories saved for this day." />
        ) : (
          <div className="grid gap-3">
            {day.repositories.map((repository) => (
              <RepositoryCard
                itemLanguage={itemLanguage}
                key={repository.id}
                repository={repository}
              />
            ))}
          </div>
        )}
      </DailySection>
    </section>
  );
}

function DailySection({
  children,
  count,
  title,
}: Readonly<{
  children: React.ReactNode;
  count: number;
  title: string;
}>) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-xs font-semibold text-[var(--color-muted)]">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function EmptyDashboard() {
  return (
    <div className="grid min-h-64 place-items-center border border-dashed border-[var(--color-border)] bg-[var(--color-panel)] p-8 text-center">
      <div className="grid max-w-md gap-3">
        <FileText className="mx-auto text-[var(--color-muted)]" size={32} strokeWidth={1.8} />
        <h2 className="text-xl font-semibold">No daily items yet</h2>
        <p className="text-sm leading-6 text-[var(--color-muted)]">
          Ingest papers or repositories to build a today-first research dashboard.
        </p>
      </div>
    </div>
  );
}

function EmptySection({ label }: { label: string }) {
  return (
    <div className="border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-muted)]">
      {label}
    </div>
  );
}

function formatDayLabel(date: string): string {
  const today = new Date().toISOString().slice(0, 10);

  if (date === today) {
    return "Today";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}
