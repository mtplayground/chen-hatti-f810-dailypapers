"use client";

import { CalendarDays, Code2, ExternalLink, GitFork, Star, type LucideIcon } from "lucide-react";

import { ItemActions } from "@/components/item-actions";
import { ItemNotesTagsEditor } from "@/components/item-notes-tags-editor";
import { ReadMoreDetails } from "@/components/read-more-details";
import type { DashboardRepository, DashboardSummary, DashboardTag } from "@/services/dashboard";

type ItemLanguage = "EN" | "ZH";

export function RepositoryCard({
  availableTags,
  itemLanguage,
  repository,
}: {
  availableTags: DashboardTag[];
  itemLanguage: ItemLanguage;
  repository: DashboardRepository;
}) {
  const summary = selectSummary(repository.summaries, itemLanguage);

  return (
    <article className="grid gap-5 border border-[var(--color-border)] bg-[var(--color-panel)] p-5 shadow-sm">
      <header className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid min-w-0 flex-1 gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-[0.08em] text-[var(--color-muted)] uppercase">
              <span>{repository.primaryLanguage ?? "Repository"}</span>
              {repository.important ? (
                <span className="text-[var(--color-accent)]">Important</span>
              ) : null}
            </div>
            <h4 className="text-xl leading-tight font-semibold">
              {summary?.headline ?? `${repository.owner}/${repository.name}`}
            </h4>
            <p className="text-sm leading-6 text-[var(--color-muted)]">
              {repository.description ?? "No repository description available."}
            </p>
          </div>
          <ItemScore label="Research value" score={repository.researchValueScore} />
        </div>

        <div className="grid gap-2 text-sm text-[var(--color-muted)] sm:grid-cols-2 lg:grid-cols-4">
          <MetadataPill icon={Star} label="Stars" value={repository.stars.toLocaleString()} />
          <MetadataPill icon={GitFork} label="Forks" value={repository.forks.toLocaleString()} />
          <MetadataPill
            icon={Code2}
            label="Language"
            value={repository.primaryLanguage ?? "Unknown"}
          />
          <MetadataPill
            icon={CalendarDays}
            label="Updated"
            value={formatOptionalDate(repository.lastUpdatedAt) ?? "Unknown"}
          />
        </div>
      </header>

      <section className="grid gap-3 border-l-4 border-[var(--color-accent)] bg-[var(--color-surface)] p-4">
        <div className="grid gap-1">
          <p className="text-xs font-semibold tracking-[0.08em] text-[var(--color-muted)] uppercase">
            README summary{summary !== null ? ` · ${summary.language}` : ""}
          </p>
          <h5 className="font-semibold">{summary?.headline ?? repository.name}</h5>
        </div>
        <p className="text-sm leading-6 text-[var(--color-muted)]">
          {summary?.summary ?? repository.description ?? "No README summary generated yet."}
        </p>
        {summary !== null && summary.keyPoints.length > 0 ? (
          <ul className="grid gap-1 text-sm leading-6 text-[var(--color-muted)]">
            {summary.keyPoints.map((point) => (
              <li className="flex gap-2" key={point}>
                <span aria-hidden="true" className="mt-2 size-1.5 bg-[var(--color-accent)]" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <ReadMoreDetails title={`${repository.owner}/${repository.name} details`}>
        <section className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-2">
            <h5 className="text-sm font-semibold">README Excerpt</h5>
            <p className="text-sm leading-7 text-[var(--color-muted)]">
              {readmeExcerpt(repository.readme)}
            </p>
          </div>

          <div className="grid gap-3">
            <AnalysisBlock
              label="Install difficulty"
              value={formatInstallDifficulty(repository.installDifficulty)}
            />
            <AnalysisBlock label="Usage notes" value={repository.installNotes} />
          </div>
        </section>

        <section className="grid gap-3">
          <h5 className="text-sm font-semibold">Repository Analysis</h5>
          <div className="grid gap-3 md:grid-cols-2">
            <AnalysisBlock label="Tech stack" value={formatTechStack(repository.techStack)} />
            <AnalysisBlock label="Research value" value={repository.researchValueNotes} />
          </div>
        </section>
      </ReadMoreDetails>

      <footer className="grid gap-3">
        <ItemActions
          archived={repository.archived}
          copyText={repositoryCopyText(repository, summary)}
          important={repository.important}
          itemId={repository.id}
          openHref={repository.url}
          openLabel="Open GitHub"
        />
        <ItemMeta tags={repository.tags} />
        <div className="flex flex-wrap gap-2">
          <ItemLink href={repository.url} label="Repository" />
        </div>
        <ItemNotesTagsEditor
          assignedTags={repository.tags}
          availableTags={availableTags}
          itemId={repository.id}
          itemLanguage={itemLanguage}
          notes={repository.notes}
        />
      </footer>
    </article>
  );
}

function MetadataPill({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-14 items-center gap-2 border border-[var(--color-border)] px-3 py-2">
      <Icon aria-hidden="true" className="shrink-0" size={16} />
      <div className="min-w-0">
        <p className="text-xs font-medium">{label}</p>
        <p className="truncate font-semibold text-[var(--color-ink)]">{value}</p>
      </div>
    </div>
  );
}

function AnalysisBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-h-24 border border-[var(--color-border)] p-3">
      <p className="text-xs font-semibold tracking-[0.08em] text-[var(--color-muted)] uppercase">
        {label}
      </p>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
        {value ?? "Not generated yet."}
      </p>
    </div>
  );
}

function ItemScore({ label, score }: { label: string; score: number | null }) {
  return (
    <div className="min-w-28 border border-[var(--color-border)] px-3 py-2 text-center">
      <p className="text-2xl font-semibold">{score ?? "-"}</p>
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

function selectSummary(summaries: DashboardSummary[], language: ItemLanguage) {
  return (
    summaries.find((summary) => summary.language === language) ??
    summaries.find((summary) => summary.language === "EN") ??
    summaries[0] ??
    null
  );
}

function repositoryCopyText(
  repository: DashboardRepository,
  summary: DashboardSummary | null,
): string {
  const lines = [
    `${repository.owner}/${repository.name}`,
    repository.description,
    `Stars: ${repository.stars.toLocaleString()} · Forks: ${repository.forks.toLocaleString()}`,
    repository.primaryLanguage !== null ? `Language: ${repository.primaryLanguage}` : null,
    repository.techStack.length > 0 ? `Tech stack: ${repository.techStack.join(", ")}` : null,
    summary !== null ? `Summary (${summary.language}): ${summary.summary}` : null,
    summary !== null && summary.keyPoints.length > 0
      ? `Key points:\n${summary.keyPoints.map((point) => `- ${point}`).join("\n")}`
      : null,
    repository.researchValueNotes !== null
      ? `Research value: ${repository.researchValueNotes}`
      : null,
    repository.url,
  ];

  return lines.filter((line): line is string => line !== null && line.trim() !== "").join("\n\n");
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

function readmeExcerpt(readme: string | null): string {
  if (readme === null || readme.trim() === "") {
    return "No README content captured yet.";
  }

  const normalized = readme.replace(/\s+/g, " ").trim();

  if (normalized.length <= 420) {
    return normalized;
  }

  return `${normalized.slice(0, 417).trimEnd()}...`;
}

function formatTechStack(techStack: string[]): string | null {
  return techStack.length > 0 ? techStack.join(", ") : null;
}

function formatInstallDifficulty(difficulty: string): string {
  return difficulty.toLowerCase().replaceAll("_", " ");
}
