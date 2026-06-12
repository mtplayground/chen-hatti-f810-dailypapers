"use client";

import { ExternalLink, FileText, GitFork, Star } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import type {
  DashboardData,
  DashboardDay,
  DashboardPaper,
  DashboardRepository,
  DashboardSummary,
  DashboardTag,
} from "@/services/dashboard";

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
              <PaperRow itemLanguage={itemLanguage} key={paper.id} paper={paper} />
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
              <RepositoryRow
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

function PaperRow({ itemLanguage, paper }: { itemLanguage: ItemLanguage; paper: DashboardPaper }) {
  const summary = selectSummary(paper.summaries, itemLanguage);
  const description = summary?.summary ?? paper.abstract ?? "No summary available yet.";

  return (
    <article className="grid gap-3 border border-[var(--color-border)] bg-[var(--color-panel)] p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="text-xs font-semibold tracking-[0.08em] text-[var(--color-muted)] uppercase">
            {paper.venue ?? formatOptionalDate(paper.publishedAt) ?? "Paper"}
          </p>
          <h4 className="text-lg font-semibold">{summary?.headline ?? paper.title}</h4>
          <p className="text-sm text-[var(--color-muted)]">
            {paper.authors.join(", ") || "Unknown authors"}
          </p>
        </div>
        <ItemScore label="Relevance" score={paper.relevanceScore} />
      </div>

      <p className="line-clamp-3 text-sm leading-6 text-[var(--color-muted)]">{description}</p>
      <ItemMeta tags={paper.tags} />
      <div className="flex flex-wrap gap-2">
        {paper.landingUrl !== null ? <ItemLink href={paper.landingUrl} label="Landing" /> : null}
        {paper.pdfUrl !== null ? <ItemLink href={paper.pdfUrl} label="PDF" /> : null}
      </div>
    </article>
  );
}

function RepositoryRow({
  itemLanguage,
  repository,
}: {
  itemLanguage: ItemLanguage;
  repository: DashboardRepository;
}) {
  const summary = selectSummary(repository.summaries, itemLanguage);
  const description = summary?.summary ?? repository.description ?? "No summary available yet.";

  return (
    <article className="grid gap-3 border border-[var(--color-border)] bg-[var(--color-panel)] p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="text-xs font-semibold tracking-[0.08em] text-[var(--color-muted)] uppercase">
            {repository.primaryLanguage ?? "Repository"}
          </p>
          <h4 className="text-lg font-semibold">
            {summary?.headline ?? `${repository.owner}/${repository.name}`}
          </h4>
          <p className="text-sm text-[var(--color-muted)]">
            Updated {formatOptionalDate(repository.lastUpdatedAt) ?? "unknown"}
          </p>
        </div>
        <ItemScore label="Value" score={repository.researchValueScore} />
      </div>

      <p className="line-clamp-3 text-sm leading-6 text-[var(--color-muted)]">{description}</p>
      <div className="flex flex-wrap gap-3 text-sm text-[var(--color-muted)]">
        <span className="inline-flex items-center gap-1">
          <Star aria-hidden="true" size={15} /> {repository.stars}
        </span>
        <span className="inline-flex items-center gap-1">
          <GitFork aria-hidden="true" size={15} /> {repository.forks}
        </span>
        <span>{repository.installDifficulty}</span>
      </div>
      <ItemMeta tags={repository.tags} />
      <div className="flex flex-wrap gap-2">
        <ItemLink href={repository.url} label="Repository" />
      </div>
    </article>
  );
}

function ItemScore({ label, score }: { label: string; score: number | null }) {
  return (
    <div className="min-w-20 border border-[var(--color-border)] px-3 py-2 text-center">
      <p className="text-lg font-semibold">{score ?? "-"}</p>
      <p className="text-xs font-medium text-[var(--color-muted)]">{label}</p>
    </div>
  );
}

function ItemMeta({ tags }: { tags: DashboardTag[] }) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span
          className="rounded-full border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-[var(--color-muted)]"
          key={tag.slug}
        >
          {tag.nameEn}
        </span>
      ))}
    </div>
  );
}

function ItemLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      className="inline-flex min-h-9 items-center gap-2 border border-[var(--color-border)] px-3 py-2 text-sm font-semibold transition hover:border-[var(--color-accent)]"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      <ExternalLink aria-hidden="true" size={15} />
      {label}
    </a>
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

function selectSummary(summaries: DashboardSummary[], language: ItemLanguage) {
  return (
    summaries.find((summary) => summary.language === language) ??
    summaries.find((summary) => summary.language === "EN") ??
    summaries[0] ??
    null
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

function formatOptionalDate(date: string | null): string | null {
  if (date === null) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(date));
}
