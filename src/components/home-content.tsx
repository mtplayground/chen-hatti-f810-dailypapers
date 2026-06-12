"use client";

import { Download, FileText } from "lucide-react";
import { useMemo, useState } from "react";

import { AddItemPanel } from "@/components/add-item-panel";
import {
  DashboardControlBar,
  defaultDashboardControls,
  type DashboardControlState,
  type DashboardSortMode,
} from "@/components/dashboard-control-bar";
import { useLanguage } from "@/components/language-provider";
import { PaperCard } from "@/components/paper-card";
import { RepositoryCard } from "@/components/repository-card";
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

type DashboardItemRow =
  | {
      kind: "PAPER";
      createdAt: string;
      paper: DashboardPaper;
      repository: null;
    }
  | {
      kind: "REPOSITORY";
      createdAt: string;
      paper: null;
      repository: DashboardRepository;
    };

export function HomeContent({ dashboard }: HomeContentProps) {
  const { language, messages } = useLanguage();
  const [controls, setControls] = useState<DashboardControlState>(defaultDashboardControls);
  const itemLanguage: ItemLanguage = language === "zh" ? "ZH" : "EN";
  const totalItems = dashboard.stats.papers + dashboard.stats.repositories;
  const visibleDashboard = useMemo(
    () => applyDashboardControls(dashboard, controls),
    [controls, dashboard],
  );
  const visibleItems = visibleDashboard.stats.papers + visibleDashboard.stats.repositories;
  const stats = [
    { label: messages.home.stats.papers, value: dashboard.stats.papers.toString() },
    { label: messages.home.stats.repositories, value: dashboard.stats.repositories.toString() },
    { label: messages.home.stats.notes, value: dashboard.stats.notes.toString() },
  ];

  return (
    <section className="grid gap-8" id="today">
      <div className="grid gap-4 border-b border-[var(--color-border)] pb-8">
        <p className="text-sm font-medium text-[var(--color-muted)]">{messages.home.eyebrow}</p>
        <div className="grid gap-4 md:grid-cols-[1fr_22rem] md:items-end">
          <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
            {messages.home.title}
          </h1>
          <div className="grid gap-3 md:justify-items-end">
            <p className="text-base leading-7 text-[var(--color-muted)] md:text-right">
              {messages.home.summary(totalItems)}
            </p>
            <div className="flex flex-wrap justify-start gap-2 md:justify-end">
              <AddItemPanel />
              <ExportLink href="/api/export/json" label="JSON" />
              <ExportLink href="/api/export/csv" label="CSV" />
            </div>
          </div>
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

      <DashboardControlBar
        controls={controls}
        onChange={setControls}
        onReset={() => setControls(defaultDashboardControls)}
        resultCount={visibleItems}
        totalCount={totalItems}
      />

      <div className="grid gap-8" id="library">
        {dashboard.days.length === 0 ? (
          <EmptyDashboard />
        ) : visibleDashboard.days.length === 0 ? (
          <EmptyFilteredDashboard />
        ) : (
          visibleDashboard.days.map((day) => (
            <DashboardDaySection
              availableTags={dashboard.availableTags}
              day={day}
              itemLanguage={itemLanguage}
              key={day.date}
            />
          ))
        )}
      </div>

      <div className="sr-only" id="exports" />
    </section>
  );
}

function DashboardDaySection({
  availableTags,
  day,
  itemLanguage,
}: {
  availableTags: DashboardTag[];
  day: DashboardDay;
  itemLanguage: ItemLanguage;
}) {
  return (
    <section className="grid gap-5 border-t border-[var(--color-border)] pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-2xl font-semibold">{formatDayLabel(day.date)}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium text-[var(--color-muted)]">
            {day.papers.length + day.repositories.length} items
          </p>
          <ExportLink
            href={`/api/export/markdown?date=${encodeURIComponent(day.date)}&language=${itemLanguage}`}
            label="Markdown"
          />
          <ExportLink href={`/api/export/json?date=${encodeURIComponent(day.date)}`} label="JSON" />
          <ExportLink href={`/api/export/csv?date=${encodeURIComponent(day.date)}`} label="CSV" />
        </div>
      </div>

      <DailySection title="Daily Papers" count={day.papers.length}>
        {day.papers.length === 0 ? (
          <EmptySection label="No papers saved for this day." />
        ) : (
          <div className="grid gap-3">
            {day.papers.map((paper) => (
              <PaperCard
                availableTags={availableTags}
                itemLanguage={itemLanguage}
                key={paper.id}
                paper={paper}
              />
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
                availableTags={availableTags}
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

function ExportLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      className="inline-flex min-h-9 items-center gap-2 border border-[var(--color-border)] px-3 py-2 text-sm font-semibold transition hover:border-[var(--color-accent)]"
      download
      href={href}
    >
      <Download aria-hidden="true" size={15} />
      {label}
    </a>
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

function EmptyFilteredDashboard() {
  return (
    <div className="grid min-h-48 place-items-center border border-dashed border-[var(--color-border)] bg-[var(--color-panel)] p-8 text-center">
      <div className="grid max-w-md gap-3">
        <FileText className="mx-auto text-[var(--color-muted)]" size={28} strokeWidth={1.8} />
        <h2 className="text-xl font-semibold">No matching items</h2>
        <p className="text-sm leading-6 text-[var(--color-muted)]">
          Adjust the search, filters, or sort controls to return to the daily dashboard.
        </p>
      </div>
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

function applyDashboardControls(
  dashboard: DashboardData,
  controls: DashboardControlState,
): DashboardData {
  const rows = flattenDashboard(dashboard)
    .filter((row) => matchesType(row, controls.type))
    .filter((row) => matchesDate(row, controls.date))
    .filter((row) => matchesQuery(row, controls.query))
    .filter((row) => matchesTopic(row, controls.topic))
    .filter((row) => matchesMinRelevance(row, controls.minRelevance))
    .sort((left, right) => compareRows(left, right, controls.sort));

  return groupRows(rows, dashboard.stats.notes, dashboard.availableTags);
}

function flattenDashboard(dashboard: DashboardData): DashboardItemRow[] {
  return dashboard.days.flatMap((day) => [
    ...day.papers.map(
      (paper): DashboardItemRow => ({
        kind: "PAPER",
        createdAt: paper.createdAt,
        paper,
        repository: null,
      }),
    ),
    ...day.repositories.map(
      (repository): DashboardItemRow => ({
        kind: "REPOSITORY",
        createdAt: repository.createdAt,
        paper: null,
        repository,
      }),
    ),
  ]);
}

function groupRows(
  rows: DashboardItemRow[],
  noteCount: number,
  availableTags: DashboardTag[],
): DashboardData {
  const grouped = new Map<string, DashboardDay>();
  let papers = 0;
  let repositories = 0;

  for (const row of rows) {
    const date = row.createdAt.slice(0, 10);
    const day =
      grouped.get(date) ??
      ({
        date,
        papers: [],
        repositories: [],
      } satisfies DashboardDay);

    if (!grouped.has(date)) {
      grouped.set(date, day);
    }

    if (row.kind === "PAPER") {
      day.papers.push(row.paper);
      papers += 1;
    } else {
      day.repositories.push(row.repository);
      repositories += 1;
    }
  }

  return {
    days: [...grouped.values()],
    availableTags,
    stats: {
      notes: noteCount,
      papers,
      repositories,
    },
  };
}

function matchesType(row: DashboardItemRow, type: DashboardControlState["type"]): boolean {
  return type === "ALL" || row.kind === type;
}

function matchesDate(row: DashboardItemRow, date: string): boolean {
  return date === "" || row.createdAt.slice(0, 10) === date;
}

function matchesQuery(row: DashboardItemRow, query: string): boolean {
  const normalized = query.trim().toLowerCase();

  if (normalized === "") {
    return true;
  }

  return searchableText(row).includes(normalized);
}

function matchesTopic(row: DashboardItemRow, topic: string): boolean {
  const normalized = topic.trim().toLowerCase();

  if (normalized === "") {
    return true;
  }

  return topicText(row).includes(normalized);
}

function matchesMinRelevance(row: DashboardItemRow, minRelevance: string): boolean {
  if (minRelevance.trim() === "") {
    return true;
  }

  const threshold = Number(minRelevance);

  if (!Number.isFinite(threshold)) {
    return true;
  }

  const score = relevanceScore(row);
  return score !== null && score >= threshold;
}

function compareRows(
  left: DashboardItemRow,
  right: DashboardItemRow,
  sort: DashboardSortMode,
): number {
  if (sort === "relevance") {
    return byNumberDesc(relevanceScore(left), relevanceScore(right)) || byDateDesc(left, right);
  }

  if (sort === "stars") {
    return byNumberDesc(starCount(left), starCount(right)) || byDateDesc(left, right);
  }

  if (sort === "updated") {
    return byNumberDesc(updatedTime(left), updatedTime(right)) || byDateDesc(left, right);
  }

  return byDateDesc(left, right);
}

function byDateDesc(left: DashboardItemRow, right: DashboardItemRow): number {
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

function byNumberDesc(left: number | null, right: number | null): number {
  return (right ?? -1) - (left ?? -1);
}

function relevanceScore(row: DashboardItemRow): number | null {
  return row.kind === "PAPER" ? row.paper.relevanceScore : row.repository.researchValueScore;
}

function starCount(row: DashboardItemRow): number | null {
  return row.kind === "REPOSITORY" ? row.repository.stars : null;
}

function updatedTime(row: DashboardItemRow): number | null {
  const value =
    row.kind === "PAPER"
      ? (row.paper.revisedAt ?? row.paper.publishedAt ?? row.paper.createdAt)
      : (row.repository.lastUpdatedAt ?? row.repository.createdAt);

  return new Date(value).getTime();
}

function searchableText(row: DashboardItemRow): string {
  if (row.kind === "PAPER") {
    const paper = row.paper;

    return normalizeSearchText([
      paper.title,
      ...paper.authors,
      paper.venue,
      paper.abstract,
      paper.problemStatement,
      paper.methodology,
      paper.keyFindings,
      paper.limitations,
      paper.relevanceNotes,
      ...summaryText(paper.summaries),
      ...tagText(paper.tags),
    ]);
  }

  const repository = row.repository;

  return normalizeSearchText([
    repository.name,
    repository.owner,
    repository.description,
    repository.primaryLanguage,
    repository.readme,
    ...repository.techStack,
    repository.installNotes,
    repository.researchValueNotes,
    ...summaryText(repository.summaries),
    ...tagText(repository.tags),
  ]);
}

function topicText(row: DashboardItemRow): string {
  if (row.kind === "PAPER") {
    return normalizeSearchText([row.paper.venue, ...tagText(row.paper.tags)]);
  }

  return normalizeSearchText([
    row.repository.primaryLanguage,
    ...row.repository.techStack,
    ...tagText(row.repository.tags),
  ]);
}

function summaryText(summaries: DashboardSummary[]): Array<string | null> {
  return summaries.flatMap((summary) => [summary.headline, summary.summary, ...summary.keyPoints]);
}

function tagText(tags: DashboardTag[]): Array<string | null> {
  return tags.flatMap((tag) => [tag.slug, tag.nameEn, tag.nameZh, tag.color]);
}

function normalizeSearchText(values: Array<string | null>): string {
  return values
    .filter((value): value is string => value !== null && value.trim().length > 0)
    .join(" ")
    .toLowerCase();
}
