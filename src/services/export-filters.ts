import { ItemKind, type Locale } from "@prisma/client";
import { z } from "zod";

import { itemKindSchema } from "@/validators/common";

const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isValidDateKey, {
    message: "Date must be a valid UTC calendar day.",
  });

const optionalSearchTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .optional()
  .transform((value) => (value === "" ? undefined : value));

function csvList(value: unknown): string[] | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const values = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return values.length > 0 ? [...new Set(values)] : undefined;
}

export const exportItemsQuerySchema = z.object({
  date: dateStringSchema.optional(),
  q: optionalSearchTextSchema,
  type: itemKindSchema.optional(),
  topic: z.preprocess(csvList, z.array(z.string().trim().min(1).max(80)).max(20).optional()),
  minRelevance: z.coerce.number().int().min(0).max(100).optional(),
  sort: z.enum(["date", "relevance", "stars", "updated"]).default("date"),
});

export type ExportItemsQueryInput = z.input<typeof exportItemsQuerySchema>;
export type ExportItemsQueryData = z.output<typeof exportItemsQuerySchema>;

type ExportTagLink = {
  tag: {
    slug: string;
    nameEn: string;
    nameZh: string | null;
    color: string | null;
  };
};

type ExportSummary = {
  headline: string | null;
  summary: string;
  keyPoints: string[];
  language: Locale;
};

type ExportPaper = {
  title: string;
  authors: string[];
  venue: string | null;
  abstract: string | null;
  problemStatement: string | null;
  methodology: string | null;
  keyFindings: string | null;
  limitations: string | null;
  relevanceScore: number | null;
  relevanceNotes: string | null;
  publishedAt: Date | null;
  revisedAt: Date | null;
};

type ExportRepository = {
  owner: string;
  name: string;
  description: string | null;
  primaryLanguage: string | null;
  readme: string | null;
  techStack: string[];
  installNotes: string | null;
  researchValueScore: number | null;
  researchValueNotes: string | null;
  stars: number;
  lastUpdatedAt: Date | null;
};

export type ExportFilterableItem = {
  kind: ItemKind;
  createdAt: Date;
  paper: ExportPaper | null;
  repository: ExportRepository | null;
  summaries: ExportSummary[];
  tags: ExportTagLink[];
};

export function parseExportItemsQuery(input: ExportItemsQueryInput): ExportItemsQueryData {
  return exportItemsQuerySchema.parse(input);
}

export function filterAndSortExportItems<T extends ExportFilterableItem>(
  items: T[],
  query: ExportItemsQueryData,
): T[] {
  return items
    .filter((item) => matchesType(item, query.type))
    .filter((item) => matchesDate(item, query.date))
    .filter((item) => matchesQuery(item, query.q))
    .filter((item) => matchesTopic(item, query.topic))
    .filter((item) => matchesMinRelevance(item, query.minRelevance))
    .sort((left, right) => compareItems(left, right, query.sort));
}

export function exportFilename(
  extension: "csv" | "json" | "md",
  query: ExportItemsQueryData,
): string {
  if (query.date !== undefined && !hasNonDateFilter(query)) {
    return `daily-papers-${query.date}.${extension}`;
  }

  if (hasAnyFilter(query)) {
    return `daily-papers-filtered.${extension}`;
  }

  return `daily-papers-items.${extension}`;
}

function hasAnyFilter(query: ExportItemsQueryData): boolean {
  return (
    query.date !== undefined ||
    query.q !== undefined ||
    query.type !== undefined ||
    query.topic !== undefined ||
    query.minRelevance !== undefined
  );
}

function hasNonDateFilter(query: ExportItemsQueryData): boolean {
  return (
    query.q !== undefined ||
    query.type !== undefined ||
    query.topic !== undefined ||
    query.minRelevance !== undefined
  );
}

function matchesType(item: ExportFilterableItem, type: ItemKind | undefined): boolean {
  return type === undefined || item.kind === type;
}

function matchesDate(item: ExportFilterableItem, date: string | undefined): boolean {
  return date === undefined || item.createdAt.toISOString().slice(0, 10) === date;
}

function matchesQuery(item: ExportFilterableItem, query: string | undefined): boolean {
  if (query === undefined) {
    return true;
  }

  return searchableText(item).includes(query.toLowerCase());
}

function matchesTopic(item: ExportFilterableItem, topic: string[] | undefined): boolean {
  if (topic === undefined) {
    return true;
  }

  const text = topicText(item);
  return topic.some((value) => text.includes(value.toLowerCase()));
}

function matchesMinRelevance(
  item: ExportFilterableItem,
  minRelevance: number | undefined,
): boolean {
  if (minRelevance === undefined) {
    return true;
  }

  const score = relevanceScore(item);
  return score !== null && score >= minRelevance;
}

function compareItems(
  left: ExportFilterableItem,
  right: ExportFilterableItem,
  sort: ExportItemsQueryData["sort"],
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

function byDateDesc(left: ExportFilterableItem, right: ExportFilterableItem): number {
  return right.createdAt.getTime() - left.createdAt.getTime();
}

function byNumberDesc(left: number | null, right: number | null): number {
  return (right ?? -1) - (left ?? -1);
}

function relevanceScore(item: ExportFilterableItem): number | null {
  return item.kind === ItemKind.PAPER
    ? (item.paper?.relevanceScore ?? null)
    : (item.repository?.researchValueScore ?? null);
}

function starCount(item: ExportFilterableItem): number | null {
  return item.kind === ItemKind.REPOSITORY ? (item.repository?.stars ?? null) : null;
}

function updatedTime(item: ExportFilterableItem): number | null {
  const value =
    item.kind === ItemKind.PAPER
      ? (item.paper?.revisedAt ?? item.paper?.publishedAt ?? item.createdAt)
      : (item.repository?.lastUpdatedAt ?? item.createdAt);

  return value.getTime();
}

function searchableText(item: ExportFilterableItem): string {
  if (item.kind === ItemKind.PAPER) {
    const paper = item.paper;

    return normalizeSearchText([
      paper?.title,
      ...(paper?.authors ?? []),
      paper?.venue,
      paper?.abstract,
      paper?.problemStatement,
      paper?.methodology,
      paper?.keyFindings,
      paper?.limitations,
      paper?.relevanceNotes,
      ...summaryText(item.summaries),
      ...tagText(item.tags),
    ]);
  }

  const repository = item.repository;

  return normalizeSearchText([
    repository?.name,
    repository?.owner,
    repository?.description,
    repository?.primaryLanguage,
    repository?.readme,
    ...(repository?.techStack ?? []),
    repository?.installNotes,
    repository?.researchValueNotes,
    ...summaryText(item.summaries),
    ...tagText(item.tags),
  ]);
}

function topicText(item: ExportFilterableItem): string {
  if (item.kind === ItemKind.PAPER) {
    return normalizeSearchText([item.paper?.venue, ...tagText(item.tags)]);
  }

  return normalizeSearchText([
    item.repository?.primaryLanguage,
    ...(item.repository?.techStack ?? []),
    ...tagText(item.tags),
  ]);
}

function summaryText(summaries: ExportSummary[]): Array<string | null> {
  return summaries.flatMap((summary) => [summary.headline, summary.summary, ...summary.keyPoints]);
}

function tagText(tags: ExportTagLink[]): Array<string | null> {
  return tags.flatMap((itemTag) => [
    itemTag.tag.slug,
    itemTag.tag.nameEn,
    itemTag.tag.nameZh,
    itemTag.tag.color,
  ]);
}

function normalizeSearchText(values: Array<string | null | undefined>): string {
  return values
    .filter((value): value is string => value !== null && value !== undefined)
    .join(" ")
    .toLowerCase();
}

function isValidDateKey(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
