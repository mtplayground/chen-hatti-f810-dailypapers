import { ItemKind, Locale, type Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const portableExportInclude = {
  paper: true,
  repository: true,
  summaries: true,
  notes: true,
  tags: {
    include: {
      tag: true,
    },
  },
} satisfies Prisma.ItemInclude;

const portableExportSchema = z.object({
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(isValidDateKey, {
      message: "Date must be a valid UTC calendar day.",
    })
    .optional(),
});

type PortableExportInput = z.input<typeof portableExportSchema>;
type PortableItemRecord = Prisma.ItemGetPayload<{
  include: typeof portableExportInclude;
}>;

type PortableTag = {
  slug: string;
  nameEn: string;
  nameZh: string | null;
  color: string | null;
};

type PortableSummary = {
  language: "EN" | "ZH";
  headline: string | null;
  summary: string;
  keyPoints: string[];
};

type PortableNote = {
  language: "EN" | "ZH";
  title: string | null;
  content: string;
  updatedAt: string;
};

type PortableItem = {
  id: string;
  kind: "PAPER" | "REPOSITORY";
  sourceUrl: string | null;
  canonicalUrl: string | null;
  important: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  tags: PortableTag[];
  summaries: PortableSummary[];
  notes: PortableNote[];
  paper: PortablePaper | null;
  repository: PortableRepository | null;
};

type PortablePaper = {
  title: string;
  authors: string[];
  venue: string | null;
  publishedAt: string | null;
  revisedAt: string | null;
  arxivId: string | null;
  doi: string | null;
  landingUrl: string | null;
  pdfUrl: string | null;
  abstract: string | null;
  problemStatement: string | null;
  methodology: string | null;
  keyFindings: string | null;
  limitations: string | null;
  relevanceScore: number | null;
  relevanceNotes: string | null;
};

type PortableRepository = {
  owner: string;
  name: string;
  url: string;
  description: string | null;
  stars: number;
  forks: number;
  primaryLanguage: string | null;
  lastUpdatedAt: string | null;
  readme: string | null;
  techStack: string[];
  installDifficulty: string;
  installNotes: string | null;
  researchValueScore: number | null;
  researchValueNotes: string | null;
};

export type JsonExportResult = {
  filename: string;
  payload: {
    exportedAt: string;
    date: string | null;
    count: number;
    items: PortableItem[];
  };
};

export type CsvExportResult = {
  filename: string;
  csv: string;
};

export async function exportItemsAsJson(
  input: PortableExportInput = {},
): Promise<JsonExportResult> {
  const data = portableExportSchema.parse(input);
  const items = await fetchPortableItems(data.date);
  const portableItems = items.map(toPortableItem);

  return {
    filename: exportFilename("json", data.date),
    payload: {
      exportedAt: new Date().toISOString(),
      date: data.date ?? null,
      count: portableItems.length,
      items: portableItems,
    },
  };
}

export async function exportItemsAsCsv(input: PortableExportInput = {}): Promise<CsvExportResult> {
  const data = portableExportSchema.parse(input);
  const items = await fetchPortableItems(data.date);

  return {
    filename: exportFilename("csv", data.date),
    csv: renderCsv(items.map(toCsvRow)),
  };
}

async function fetchPortableItems(date: string | undefined): Promise<PortableItemRecord[]> {
  const where: Prisma.ItemWhereInput = {
    archived: false,
  };

  if (date !== undefined) {
    const start = new Date(`${date}T00:00:00.000Z`);
    where.createdAt = {
      gte: start,
      lt: new Date(start.getTime() + 24 * 60 * 60 * 1000),
    };
  }

  return prisma.item.findMany({
    where,
    orderBy: {
      createdAt: "asc",
    },
    include: portableExportInclude,
  });
}

function toPortableItem(item: PortableItemRecord): PortableItem {
  return {
    id: item.id,
    kind: item.kind === ItemKind.PAPER ? "PAPER" : "REPOSITORY",
    sourceUrl: item.sourceUrl,
    canonicalUrl: item.canonicalUrl,
    important: item.important,
    archived: item.archived,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    tags: item.tags.map((itemTag) => ({
      slug: itemTag.tag.slug,
      nameEn: itemTag.tag.nameEn,
      nameZh: itemTag.tag.nameZh,
      color: itemTag.tag.color,
    })),
    summaries: item.summaries.map((summary) => ({
      language: summary.language === Locale.ZH ? "ZH" : "EN",
      headline: summary.headline,
      summary: summary.summary,
      keyPoints: summary.keyPoints,
    })),
    notes: item.notes.map((note) => ({
      language: note.language === Locale.ZH ? "ZH" : "EN",
      title: note.title,
      content: note.content,
      updatedAt: note.updatedAt.toISOString(),
    })),
    paper: item.paper === null ? null : toPortablePaper(item.paper),
    repository: item.repository === null ? null : toPortableRepository(item.repository),
  };
}

function toPortablePaper(paper: NonNullable<PortableItemRecord["paper"]>): PortablePaper {
  return {
    title: paper.title,
    authors: paper.authors,
    venue: paper.venue,
    publishedAt: dateOrNull(paper.publishedAt),
    revisedAt: dateOrNull(paper.revisedAt),
    arxivId: paper.arxivId,
    doi: paper.doi,
    landingUrl: paper.landingUrl,
    pdfUrl: paper.pdfUrl,
    abstract: paper.abstract,
    problemStatement: paper.problemStatement,
    methodology: paper.methodology,
    keyFindings: paper.keyFindings,
    limitations: paper.limitations,
    relevanceScore: paper.relevanceScore,
    relevanceNotes: paper.relevanceNotes,
  };
}

function toPortableRepository(
  repository: NonNullable<PortableItemRecord["repository"]>,
): PortableRepository {
  return {
    owner: repository.owner,
    name: repository.name,
    url: repository.url,
    description: repository.description,
    stars: repository.stars,
    forks: repository.forks,
    primaryLanguage: repository.primaryLanguage,
    lastUpdatedAt: dateOrNull(repository.lastUpdatedAt),
    readme: repository.readme,
    techStack: repository.techStack,
    installDifficulty: repository.installDifficulty,
    installNotes: repository.installNotes,
    researchValueScore: repository.researchValueScore,
    researchValueNotes: repository.researchValueNotes,
  };
}

function toCsvRow(item: PortableItemRecord): Record<string, string | number | boolean | null> {
  const paper = item.paper;
  const repository = item.repository;

  return {
    id: item.id,
    kind: item.kind,
    created_at: item.createdAt.toISOString(),
    updated_at: item.updatedAt.toISOString(),
    important: item.important,
    source_url: item.sourceUrl,
    canonical_url: item.canonicalUrl,
    title: paper?.title ?? null,
    authors: paper?.authors.join("; ") ?? null,
    venue: paper?.venue ?? null,
    published_at: dateOrNull(paper?.publishedAt ?? null),
    revised_at: dateOrNull(paper?.revisedAt ?? null),
    arxiv_id: paper?.arxivId ?? null,
    doi: paper?.doi ?? null,
    paper_url: paper?.landingUrl ?? paper?.pdfUrl ?? null,
    abstract: paper?.abstract ?? null,
    relevance_score: paper?.relevanceScore ?? null,
    relevance_notes: paper?.relevanceNotes ?? null,
    repo_owner: repository?.owner ?? null,
    repo_name: repository?.name ?? null,
    repo_url: repository?.url ?? null,
    repo_description: repository?.description ?? null,
    stars: repository?.stars ?? null,
    forks: repository?.forks ?? null,
    primary_language: repository?.primaryLanguage ?? null,
    last_updated_at: dateOrNull(repository?.lastUpdatedAt ?? null),
    tech_stack: repository?.techStack.join("; ") ?? null,
    install_difficulty: repository?.installDifficulty ?? null,
    research_value_score: repository?.researchValueScore ?? null,
    research_value_notes: repository?.researchValueNotes ?? null,
    tags: item.tags.map((itemTag) => itemTag.tag.nameEn).join("; "),
    summary_en: summaryForLocale(item, Locale.EN)?.summary ?? null,
    key_points_en: summaryForLocale(item, Locale.EN)?.keyPoints.join("; ") ?? null,
    summary_zh: summaryForLocale(item, Locale.ZH)?.summary ?? null,
    key_points_zh: summaryForLocale(item, Locale.ZH)?.keyPoints.join("; ") ?? null,
    notes_en: noteForLocale(item, Locale.EN)?.content ?? null,
    notes_zh: noteForLocale(item, Locale.ZH)?.content ?? null,
  };
}

function renderCsv(rows: Array<Record<string, string | number | boolean | null>>): string {
  const headers = [
    "id",
    "kind",
    "created_at",
    "updated_at",
    "important",
    "source_url",
    "canonical_url",
    "title",
    "authors",
    "venue",
    "published_at",
    "revised_at",
    "arxiv_id",
    "doi",
    "paper_url",
    "abstract",
    "relevance_score",
    "relevance_notes",
    "repo_owner",
    "repo_name",
    "repo_url",
    "repo_description",
    "stars",
    "forks",
    "primary_language",
    "last_updated_at",
    "tech_stack",
    "install_difficulty",
    "research_value_score",
    "research_value_notes",
    "tags",
    "summary_en",
    "key_points_en",
    "summary_zh",
    "key_points_zh",
    "notes_en",
    "notes_zh",
  ];
  const csvRows = [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))];

  return `${csvRows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function csvCell(value: string | number | boolean): string {
  const text = String(value).replace(/\r?\n/g, " ").trim();
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function summaryForLocale(item: PortableItemRecord, locale: Locale) {
  return item.summaries.find((summary) => summary.language === locale) ?? null;
}

function noteForLocale(item: PortableItemRecord, locale: Locale) {
  return item.notes.find((note) => note.language === locale) ?? null;
}

function exportFilename(extension: "json" | "csv", date: string | undefined): string {
  return date === undefined
    ? `daily-papers-items.${extension}`
    : `daily-papers-${date}.${extension}`;
}

function dateOrNull(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}

function isValidDateKey(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
