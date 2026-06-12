"use client";

import { BookOpen, CalendarDays, ExternalLink, Link2, type LucideIcon } from "lucide-react";

import { ItemActions } from "@/components/item-actions";
import { ItemNotesTagsEditor } from "@/components/item-notes-tags-editor";
import { ReadMoreDetails } from "@/components/read-more-details";
import type { DashboardPaper, DashboardSummary, DashboardTag } from "@/services/dashboard";

type ItemLanguage = "EN" | "ZH";

export function PaperCard({
  availableTags,
  itemLanguage,
  paper,
}: {
  availableTags: DashboardTag[];
  itemLanguage: ItemLanguage;
  paper: DashboardPaper;
}) {
  const summary = selectSummary(paper.summaries, itemLanguage);
  const links = paperLinks(paper);

  return (
    <article className="grid gap-5 border border-[var(--color-border)] bg-[var(--color-panel)] p-5 shadow-sm">
      <header className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid min-w-0 flex-1 gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-[0.08em] text-[var(--color-muted)] uppercase">
              <span>{paper.venue ?? "Paper"}</span>
              {paper.important ? (
                <span className="text-[var(--color-accent)]">Important</span>
              ) : null}
            </div>
            <h4 className="text-xl leading-tight font-semibold">{paper.title}</h4>
            <p className="text-sm leading-6 text-[var(--color-muted)]">
              {paper.authors.length > 0 ? paper.authors.join(", ") : "Unknown authors"}
            </p>
          </div>
          <ItemScore label="Relevance" score={paper.relevanceScore} />
        </div>

        <div className="grid gap-2 text-sm text-[var(--color-muted)] sm:grid-cols-2 lg:grid-cols-4">
          <MetadataPill
            icon={CalendarDays}
            label="Published"
            value={formatOptionalDate(paper.publishedAt) ?? "Unknown"}
          />
          <MetadataPill
            icon={CalendarDays}
            label="Revised"
            value={formatOptionalDate(paper.revisedAt) ?? "Unknown"}
          />
          <MetadataPill icon={BookOpen} label="arXiv" value={paper.arxivId ?? "None"} />
          <MetadataPill icon={Link2} label="DOI" value={paper.doi ?? "None"} />
        </div>
      </header>

      {summary !== null ? (
        <section className="grid gap-3 border-l-4 border-[var(--color-accent)] bg-[var(--color-surface)] p-4">
          <div className="grid gap-1">
            <p className="text-xs font-semibold tracking-[0.08em] text-[var(--color-muted)] uppercase">
              AI summary · {summary.language}
            </p>
            <h5 className="font-semibold">{summary.headline ?? paper.title}</h5>
          </div>
          <p className="text-sm leading-6 text-[var(--color-muted)]">{summary.summary}</p>
          {summary.keyPoints.length > 0 ? (
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
      ) : (
        <SummaryEmptyState kind="paper" />
      )}

      <ReadMoreDetails title={`${paper.title} details`}>
        <section className="grid gap-2">
          <h5 className="text-sm font-semibold">Abstract</h5>
          <p className="text-sm leading-7 text-[var(--color-muted)]">
            {paper.abstract ?? "No abstract available."}
          </p>
        </section>

        <section className="grid gap-3">
          <h5 className="text-sm font-semibold">Structured Analysis</h5>
          <div className="grid gap-3 md:grid-cols-2">
            <AnalysisBlock label="Problem" value={paper.problemStatement} />
            <AnalysisBlock label="Method design" value={paper.methodology} />
            <AnalysisBlock label="Experiments / findings" value={paper.keyFindings} />
            <AnalysisBlock label="Limitations" value={paper.limitations} />
          </div>
          {paper.relevanceNotes !== null ? (
            <p className="border border-[var(--color-border)] bg-[var(--color-panel)] p-3 text-sm leading-7 text-[var(--color-muted)]">
              <span className="font-semibold text-[var(--color-ink)]">Relevance notes: </span>
              {paper.relevanceNotes}
            </p>
          ) : null}
        </section>
      </ReadMoreDetails>

      <footer className="grid gap-3">
        <ItemActions
          archived={paper.archived}
          copyText={paperCopyText(paper, summary)}
          important={paper.important}
          itemId={paper.id}
          openHref={links[0]?.href ?? null}
          openLabel={links[0]?.label === "PDF" ? "Open PDF" : "Open paper"}
        />
        <ItemMeta tags={paper.tags} />
        <div className="grid gap-2 min-[420px]:grid-cols-2 sm:flex sm:flex-wrap">
          {links.map((link) => (
            <ItemLink href={link.href} key={`${link.label}:${link.href}`} label={link.label} />
          ))}
        </div>
        <ItemNotesTagsEditor
          assignedTags={paper.tags}
          availableTags={availableTags}
          itemId={paper.id}
          itemLanguage={itemLanguage}
          notes={paper.notes}
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
    <div className="min-w-24 border border-[var(--color-border)] px-3 py-2 text-center">
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
      className="inline-flex min-h-9 w-full items-center justify-center gap-2 border border-[var(--color-border)] px-3 py-2 text-sm font-semibold transition hover:border-[var(--color-accent)] sm:w-auto"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      <ExternalLink aria-hidden="true" size={15} />
      {label}
    </a>
  );
}

function SummaryEmptyState({ kind }: { kind: "paper" }) {
  return (
    <section className="grid gap-2 border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-sm font-semibold">Summary unavailable</p>
      <p className="text-sm leading-6 text-[var(--color-muted)]">
        This {kind} has been saved, but no generated summary is available yet.
      </p>
    </section>
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

function paperLinks(paper: DashboardPaper) {
  const links: Array<{ href: string; label: string }> = [];
  const seen = new Set<string>();

  for (const [label, href] of [
    ["Landing", paper.landingUrl],
    ["PDF", paper.pdfUrl],
    ["Source", paper.sourceUrl],
    ["Canonical", paper.canonicalUrl],
  ] as const) {
    if (href !== null && !seen.has(href)) {
      seen.add(href);
      links.push({ href, label });
    }
  }

  return links;
}

function paperCopyText(paper: DashboardPaper, summary: DashboardSummary | null): string {
  const lines = [
    paper.title,
    paper.authors.length > 0 ? `Authors: ${paper.authors.join(", ")}` : null,
    paper.venue !== null ? `Venue: ${paper.venue}` : null,
    summary !== null ? `Summary (${summary.language}): ${summary.summary}` : null,
    summary !== null && summary.keyPoints.length > 0
      ? `Key points:\n${summary.keyPoints.map((point) => `- ${point}`).join("\n")}`
      : null,
    paper.relevanceNotes !== null ? `Relevance: ${paper.relevanceNotes}` : null,
    paper.pdfUrl ?? paper.landingUrl ?? paper.sourceUrl ?? paper.canonicalUrl,
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
