import { z } from "zod";

import { searchArxivPapersByKeywords, type ArxivPaperMetadata } from "@/fetchers/arxiv";
import {
  ArxivFieldPresetError,
  resolveArxivFieldKeywords,
  type ArxivFieldPresetId,
} from "@/services/arxiv-field-presets";
import { prisma } from "@/lib/prisma";
import {
  ingestUrl,
  type AutoSummarizationResult,
  type IngestionSource,
} from "@/services/ingestion";

const DEFAULT_MAX_RESULTS = 10;
const MAX_RESULTS_LIMIT = 50;

const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isValidDateKey, {
    message: "Date must be a valid UTC calendar day.",
  });

const keywordListSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    return normalizeKeywords(Array.isArray(value) ? value : splitKeywords(value));
  });

const optionalBooleanSchema = z.preprocess(booleanValue, z.boolean().optional());
const defaultTrueBooleanSchema = z.preprocess(booleanValue, z.boolean().default(true));
const defaultFalseBooleanSchema = z.preprocess(booleanValue, z.boolean().default(false));

const dailyArxivFetchSchema = z
  .object({
    field: z.string().trim().optional(),
    keywords: keywordListSchema,
    maxResults: z.coerce.number().int().min(1).max(MAX_RESULTS_LIMIT).optional(),
    date: dateStringSchema.optional(),
    submittedAfter: z.coerce.date().optional(),
    important: optionalBooleanSchema,
    autoSummarize: defaultTrueBooleanSchema,
    dryRun: defaultFalseBooleanSchema,
  })
  .refine((value) => value.date === undefined || value.submittedAfter === undefined, {
    message: "Use either date or submittedAfter, not both.",
    path: ["date"],
  });

export type DailyArxivFetchInput = z.input<typeof dailyArxivFetchSchema>;
type DailyArxivFetchData = z.output<typeof dailyArxivFetchSchema>;

export type DailyArxivFetchResult = {
  field: ArxivFieldPresetId | null;
  keywordSource: "preset" | "custom" | "environment";
  keywords: string[];
  submittedAfter: string;
  maxResults: number;
  dryRun: boolean;
  fetched: number;
  ingested: number;
  skipped: number;
  failed: number;
  results: DailyArxivFetchItemResult[];
};

export type DailyArxivFetchItemResult =
  | {
      arxivId: string;
      title: string;
      url: string;
      status: "SKIPPED_EXISTING";
      itemId: string;
    }
  | {
      arxivId: string;
      title: string;
      url: string;
      status: "DRY_RUN";
    }
  | {
      arxivId: string;
      title: string;
      url: string;
      status: "INGESTED";
      source: IngestionSource;
      itemId: string;
      summary: AutoSummarizationResult | null;
    }
  | {
      arxivId: string;
      title: string;
      url: string;
      status: "FAILED";
      error: string;
    };

export class DailyArxivFetchError extends Error {
  constructor(
    message: string,
    readonly code: "CONFIG" | "FETCH_FAILED",
  ) {
    super(message);
    this.name = "DailyArxivFetchError";
  }
}

export async function fetchDailyArxivPapers(input: unknown = {}): Promise<DailyArxivFetchResult> {
  const data = dailyArxivFetchSchema.parse(input);
  const resolvedKeywords = resolveDailyKeywords(data);
  const keywords = resolvedKeywords.keywords;
  const maxResults = data.maxResults ?? getConfiguredMaxResults();
  const submittedAfter = submittedAfterFromInput(data);
  const papers = await searchArxivPapers(keywords, maxResults, submittedAfter);
  const results: DailyArxivFetchItemResult[] = [];

  for (const paper of papers) {
    results.push(await processPaper(paper, data));
  }

  return {
    field: resolvedKeywords.field,
    keywordSource: resolvedKeywords.source,
    keywords,
    submittedAfter: submittedAfter.toISOString(),
    maxResults,
    dryRun: data.dryRun,
    fetched: papers.length,
    ingested: results.filter((result) => result.status === "INGESTED").length,
    skipped: results.filter(
      (result) => result.status === "SKIPPED_EXISTING" || result.status === "DRY_RUN",
    ).length,
    failed: results.filter((result) => result.status === "FAILED").length,
    results,
  };
}

async function searchArxivPapers(
  keywords: string[],
  maxResults: number,
  submittedAfter: Date,
): Promise<ArxivPaperMetadata[]> {
  try {
    return await searchArxivPapersByKeywords({
      keywords,
      maxResults,
      submittedAfter,
    });
  } catch (error) {
    throw new DailyArxivFetchError(
      error instanceof Error ? error.message : "Unable to fetch arXiv keyword results.",
      "FETCH_FAILED",
    );
  }
}

async function processPaper(
  paper: ArxivPaperMetadata,
  data: DailyArxivFetchData,
): Promise<DailyArxivFetchItemResult> {
  try {
    const existingItem = await prisma.item.findFirst({
      where: {
        OR: [{ canonicalUrl: paper.canonicalUrl }, { paper: { is: { arxivId: paper.arxivId } } }],
      },
      select: {
        id: true,
      },
    });

    if (existingItem !== null) {
      return {
        arxivId: paper.arxivId,
        title: paper.title,
        url: paper.landingUrl,
        status: "SKIPPED_EXISTING",
        itemId: existingItem.id,
      };
    }

    if (data.dryRun) {
      return {
        arxivId: paper.arxivId,
        title: paper.title,
        url: paper.landingUrl,
        status: "DRY_RUN",
      };
    }

    const result = await ingestUrl({
      url: paper.landingUrl,
      important: data.important,
      autoSummarize: data.autoSummarize,
    });

    return {
      arxivId: paper.arxivId,
      title: paper.title,
      url: paper.landingUrl,
      status: "INGESTED",
      source: result.source,
      itemId: result.item.id,
      summary: result.summary,
    };
  } catch (error) {
    return {
      arxivId: paper.arxivId,
      title: paper.title,
      url: paper.landingUrl,
      status: "FAILED",
      error: error instanceof Error ? error.message : "Unknown arXiv daily fetch error.",
    };
  }
}

function resolveDailyKeywords(data: DailyArxivFetchData): {
  field: ArxivFieldPresetId | null;
  source: "preset" | "custom" | "environment";
  keywords: string[];
} {
  try {
    const resolved = resolveArxivFieldKeywords({ field: data.field, keywords: data.keywords });

    if (resolved !== null) {
      return {
        field: resolved.field.id,
        source: resolved.source,
        keywords: resolved.keywords,
      };
    }
  } catch (error) {
    if (error instanceof ArxivFieldPresetError) {
      throw new DailyArxivFetchError(error.message, "CONFIG");
    }

    throw error;
  }

  return {
    field: null,
    source: "environment",
    keywords: getConfiguredKeywords(),
  };
}

function submittedAfterFromInput(data: DailyArxivFetchData): Date {
  if (data.submittedAfter !== undefined) {
    return data.submittedAfter;
  }

  if (data.date !== undefined) {
    return new Date(`${data.date}T00:00:00.000Z`);
  }

  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

function getConfiguredKeywords(): string[] {
  const raw = process.env["ARXIV_DAILY_KEYWORDS"] ?? process.env["ARXIV_KEYWORDS"];

  if (raw === undefined || raw.trim() === "") {
    throw new DailyArxivFetchError(
      "Configure ARXIV_DAILY_KEYWORDS or ARXIV_KEYWORDS before running the daily arXiv fetch.",
      "CONFIG",
    );
  }

  return normalizeKeywords(splitKeywords(raw));
}

function getConfiguredMaxResults(): number {
  const raw = process.env["ARXIV_DAILY_MAX_RESULTS"];

  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_MAX_RESULTS;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_RESULTS_LIMIT) {
    throw new DailyArxivFetchError(
      `ARXIV_DAILY_MAX_RESULTS must be an integer from 1 to ${MAX_RESULTS_LIMIT}.`,
      "CONFIG",
    );
  }

  return parsed;
}

function splitKeywords(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);
}

function normalizeKeywords(keywords: string[]): string[] {
  return [
    ...new Set(keywords.map((keyword) => keyword.trim()).filter((keyword) => keyword !== "")),
  ];
}

function booleanValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  if (value === "true" || value === "1" || value === "on") {
    return true;
  }

  if (value === "false" || value === "0" || value === "off") {
    return false;
  }

  return value;
}

function isValidDateKey(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
