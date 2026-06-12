import { ItemKind, Locale, type Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  exportFilename,
  filterAndSortExportItems,
  parseExportItemsQuery,
  type ExportItemsQueryInput,
} from "@/services/export-filters";

const exportItemInclude = {
  paper: true,
  repository: true,
  summaries: true,
  tags: {
    include: {
      tag: true,
    },
  },
} satisfies Prisma.ItemInclude;

const markdownExportSchema = z
  .object({
    language: z.enum(["EN", "ZH"]).default("EN"),
  })
  .passthrough();

type ExportItemRecord = Prisma.ItemGetPayload<{
  include: typeof exportItemInclude;
}>;

type MarkdownExportInput = ExportItemsQueryInput & z.input<typeof markdownExportSchema>;

export type MarkdownExportResult = {
  date: string;
  filename: string;
  markdown: string;
};

export async function exportMarkdownForDay(
  input: MarkdownExportInput,
): Promise<MarkdownExportResult> {
  const data = markdownExportSchema.parse(input);
  const query = parseExportItemsQuery(input);
  const items = filterAndSortExportItems(await fetchMarkdownItems(), query);

  return {
    date: query.date ?? "filtered",
    filename: exportFilename("md", query),
    markdown: renderMarkdownExport(query.date, data.language, items),
  };
}

async function fetchMarkdownItems(): Promise<ExportItemRecord[]> {
  return prisma.item.findMany({
    where: {
      archived: false,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: exportItemInclude,
  });
}

function renderMarkdownExport(
  date: string | undefined,
  language: "EN" | "ZH",
  items: ExportItemRecord[],
): string {
  const papers = items.filter((item) => item.kind === ItemKind.PAPER && item.paper !== null);
  const repositories = items.filter(
    (item) => item.kind === ItemKind.REPOSITORY && item.repository !== null,
  );
  const lines = [
    date === undefined ? "# Daily Papers - Filtered Export" : `# Daily Papers - ${date}`,
    "",
    "## Papers",
    "",
    ...renderPapers(papers, language),
    "",
    "## GitHub Repositories",
    "",
    ...renderRepositories(repositories, language),
    "",
  ];

  return `${lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}

function renderPapers(items: ExportItemRecord[], language: "EN" | "ZH"): string[] {
  if (items.length === 0) {
    return ["_No papers saved for this day._"];
  }

  return items.flatMap((item, index) => {
    const paper = item.paper;

    if (paper === null) {
      return [];
    }

    const summary = selectSummary(item, language);
    const link = paper.pdfUrl ?? paper.landingUrl ?? item.sourceUrl ?? item.canonicalUrl;
    const lines = [
      `### ${index + 1}. ${markdownLink(paper.title, link)}`,
      detail("Authors", paper.authors.length > 0 ? paper.authors.join(", ") : null),
      detail("Venue", paper.venue),
      detail("Published", formatDate(paper.publishedAt)),
      detail("Revised", formatDate(paper.revisedAt)),
      detail("arXiv", paper.arxivId),
      detail("DOI", paper.doi),
      detail("Tags", formatTags(item)),
      detail("Abstract", paper.abstract),
      detail(`AI Summary (${summary?.language ?? language})`, summary?.summary ?? null),
      ...keyPointDetails(summary?.keyPoints ?? []),
      detail("Relevance", paper.relevanceNotes),
      detail("PDF", paper.pdfUrl),
      detail("Landing", paper.landingUrl),
    ];

    return [...compactLines(lines), ""];
  });
}

function renderRepositories(items: ExportItemRecord[], language: "EN" | "ZH"): string[] {
  if (items.length === 0) {
    return ["_No repositories saved for this day._"];
  }

  return items.flatMap((item, index) => {
    const repository = item.repository;

    if (repository === null) {
      return [];
    }

    const summary = selectSummary(item, language);
    const lines = [
      `### ${index + 1}. ${markdownLink(`${repository.owner}/${repository.name}`, repository.url)}`,
      detail("Description", repository.description),
      detail("Language", repository.primaryLanguage),
      detail("Stars", repository.stars.toLocaleString()),
      detail("Forks", repository.forks.toLocaleString()),
      detail("Updated", formatDate(repository.lastUpdatedAt)),
      detail(
        "Tech Stack",
        repository.techStack.length > 0 ? repository.techStack.join(", ") : null,
      ),
      detail("Install Difficulty", formatInstallDifficulty(repository.installDifficulty)),
      detail("Install Notes", repository.installNotes),
      detail("Tags", formatTags(item)),
      detail(`README Summary (${summary?.language ?? language})`, summary?.summary ?? null),
      ...keyPointDetails(summary?.keyPoints ?? []),
      detail("Research Value", repository.researchValueNotes),
      detail("Repository", repository.url),
    ];

    return [...compactLines(lines), ""];
  });
}

function selectSummary(item: ExportItemRecord, language: "EN" | "ZH") {
  const locale = language === "ZH" ? Locale.ZH : Locale.EN;

  return (
    item.summaries.find((summary) => summary.language === locale) ??
    item.summaries.find((summary) => summary.language === Locale.EN) ??
    item.summaries[0] ??
    null
  );
}

function detail(label: string, value: string | null): string | null {
  const normalized = normalizeInlineText(value);

  if (normalized === null) {
    return null;
  }

  return `- **${label}:** ${normalized}`;
}

function keyPointDetails(keyPoints: string[]): string[] {
  if (keyPoints.length === 0) {
    return [];
  }

  return [
    "- **Key Points:**",
    ...keyPoints.map((point) => `  - ${normalizeInlineText(point) ?? ""}`),
  ];
}

function compactLines(lines: Array<string | null>): string[] {
  return lines.filter((line): line is string => line !== null);
}

function formatTags(item: ExportItemRecord): string | null {
  const tags = item.tags.map((itemTag) => itemTag.tag.nameEn);
  return tags.length > 0 ? tags.join(", ") : null;
}

function formatDate(date: Date | null): string | null {
  return date === null ? null : date.toISOString().slice(0, 10);
}

function formatInstallDifficulty(difficulty: string): string {
  return difficulty.toLowerCase().replaceAll("_", " ");
}

function markdownLink(label: string, href: string | null): string {
  if (href === null) {
    return escapeMarkdownLabel(label);
  }

  return `[${escapeMarkdownLabel(label)}](${href})`;
}

function escapeMarkdownLabel(value: string): string {
  return value.replaceAll("[", "\\[").replaceAll("]", "\\]");
}

function normalizeInlineText(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized === "" ? null : normalized;
}
