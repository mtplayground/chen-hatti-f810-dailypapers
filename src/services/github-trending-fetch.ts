import { z } from "zod";

import {
  searchGitHubTrendingRepositories,
  type GitHubRepositorySearchResult,
} from "@/fetchers/github";
import { prisma } from "@/lib/prisma";
import {
  ingestUrl,
  type AutoSummarizationResult,
  type IngestionSource,
} from "@/services/ingestion";

const DEFAULT_MAX_RESULTS = 10;
const MAX_RESULTS_LIMIT = 50;
const DEFAULT_MIN_STARS = 50;
const DEFAULT_LOOKBACK_DAYS = 7;

const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isValidDateKey, {
    message: "Date must be a valid UTC calendar day.",
  });

const listSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    return normalizeList(Array.isArray(value) ? value : splitList(value));
  });

const optionalBooleanSchema = z.preprocess(booleanValue, z.boolean().optional());
const defaultTrueBooleanSchema = z.preprocess(booleanValue, z.boolean().default(true));
const defaultFalseBooleanSchema = z.preprocess(booleanValue, z.boolean().default(false));

const githubTrendingFetchSchema = z
  .object({
    keywords: listSchema,
    topics: listSchema,
    maxResults: z.coerce.number().int().min(1).max(MAX_RESULTS_LIMIT).optional(),
    minStars: z.coerce.number().int().min(0).optional(),
    lookbackDays: z.coerce.number().int().min(1).max(365).optional(),
    pushedAfter: z.coerce.date().optional(),
    date: dateStringSchema.optional(),
    important: optionalBooleanSchema,
    autoSummarize: defaultTrueBooleanSchema,
    dryRun: defaultFalseBooleanSchema,
  })
  .refine((value) => value.date === undefined || value.pushedAfter === undefined, {
    message: "Use either date or pushedAfter, not both.",
    path: ["date"],
  });

type GitHubTrendingFetchData = z.output<typeof githubTrendingFetchSchema>;

export type GitHubTrendingFetchResult = {
  keywords: string[];
  topics: string[];
  pushedAfter: string;
  maxResults: number;
  minStars: number;
  dryRun: boolean;
  fetched: number;
  ingested: number;
  skipped: number;
  failed: number;
  results: GitHubTrendingFetchItemResult[];
};

export type GitHubTrendingFetchItemResult =
  | {
      repository: string;
      url: string;
      stars: number;
      status: "SKIPPED_EXISTING";
      itemId: string;
    }
  | {
      repository: string;
      url: string;
      stars: number;
      status: "DRY_RUN";
    }
  | {
      repository: string;
      url: string;
      stars: number;
      status: "INGESTED";
      source: IngestionSource;
      itemId: string;
      summary: AutoSummarizationResult | null;
    }
  | {
      repository: string;
      url: string;
      stars: number;
      status: "FAILED";
      error: string;
    };

export class GitHubTrendingFetchError extends Error {
  constructor(
    message: string,
    readonly code: "CONFIG" | "FETCH_FAILED",
  ) {
    super(message);
    this.name = "GitHubTrendingFetchError";
  }
}

export async function fetchGitHubTrendingRepositories(
  input: unknown = {},
): Promise<GitHubTrendingFetchResult> {
  const data = githubTrendingFetchSchema.parse(input);
  const keywords = data.keywords ?? getConfiguredList("GITHUB_TRENDING_KEYWORDS");
  const topics = data.topics ?? getConfiguredList("GITHUB_TRENDING_TOPICS");
  const maxResults = data.maxResults ?? getConfiguredMaxResults();
  const minStars = data.minStars ?? getConfiguredMinStars();
  const pushedAfter = pushedAfterFromInput(data);
  const searchTerms = ensureSearchTerms(keywords, topics);
  const repositories = await searchTrendingRepositories(
    searchTerms.keywords,
    searchTerms.topics,
    maxResults,
    minStars,
    pushedAfter,
  );
  const results: GitHubTrendingFetchItemResult[] = [];

  for (const repository of repositories) {
    results.push(await processRepository(repository, data));
  }

  return {
    keywords: searchTerms.keywords,
    topics: searchTerms.topics,
    pushedAfter: pushedAfter.toISOString(),
    maxResults,
    minStars,
    dryRun: data.dryRun,
    fetched: repositories.length,
    ingested: results.filter((result) => result.status === "INGESTED").length,
    skipped: results.filter(
      (result) => result.status === "SKIPPED_EXISTING" || result.status === "DRY_RUN",
    ).length,
    failed: results.filter((result) => result.status === "FAILED").length,
    results,
  };
}

async function searchTrendingRepositories(
  keywords: string[],
  topics: string[],
  maxResults: number,
  minStars: number,
  pushedAfter: Date,
): Promise<GitHubRepositorySearchResult[]> {
  try {
    return await searchGitHubTrendingRepositories({
      keywords,
      topics,
      maxResults,
      minStars,
      pushedAfter,
    });
  } catch (error) {
    throw new GitHubTrendingFetchError(
      error instanceof Error ? error.message : "Unable to fetch GitHub trending repositories.",
      "FETCH_FAILED",
    );
  }
}

async function processRepository(
  repository: GitHubRepositorySearchResult,
  data: GitHubTrendingFetchData,
): Promise<GitHubTrendingFetchItemResult> {
  try {
    const existingItem = await prisma.item.findFirst({
      where: {
        OR: [
          { canonicalUrl: repository.canonicalUrl },
          { repository: { is: { url: repository.url } } },
        ],
      },
      select: {
        id: true,
      },
    });

    if (existingItem !== null) {
      return {
        repository: repository.fullName,
        url: repository.url,
        stars: repository.stars,
        status: "SKIPPED_EXISTING",
        itemId: existingItem.id,
      };
    }

    if (data.dryRun) {
      return {
        repository: repository.fullName,
        url: repository.url,
        stars: repository.stars,
        status: "DRY_RUN",
      };
    }

    const result = await ingestUrl({
      url: repository.url,
      important: data.important,
      autoSummarize: data.autoSummarize,
    });

    return {
      repository: repository.fullName,
      url: repository.url,
      stars: repository.stars,
      status: "INGESTED",
      source: result.source,
      itemId: result.item.id,
      summary: result.summary,
    };
  } catch (error) {
    return {
      repository: repository.fullName,
      url: repository.url,
      stars: repository.stars,
      status: "FAILED",
      error: error instanceof Error ? error.message : "Unknown GitHub trending fetch error.",
    };
  }
}

function ensureSearchTerms(keywords: string[] | undefined, topics: string[] | undefined) {
  const normalizedKeywords = keywords ?? [];
  const normalizedTopics = topics ?? [];

  if (normalizedKeywords.length === 0 && normalizedTopics.length === 0) {
    throw new GitHubTrendingFetchError(
      "Configure GITHUB_TRENDING_KEYWORDS or GITHUB_TRENDING_TOPICS before running the GitHub trending fetch.",
      "CONFIG",
    );
  }

  return {
    keywords: normalizedKeywords,
    topics: normalizedTopics,
  };
}

function pushedAfterFromInput(data: GitHubTrendingFetchData): Date {
  if (data.pushedAfter !== undefined) {
    return data.pushedAfter;
  }

  if (data.date !== undefined) {
    return new Date(`${data.date}T00:00:00.000Z`);
  }

  const lookbackDays = data.lookbackDays ?? getConfiguredLookbackDays();
  return new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
}

function getConfiguredList(key: "GITHUB_TRENDING_KEYWORDS" | "GITHUB_TRENDING_TOPICS") {
  const raw = process.env[key];
  return raw === undefined || raw.trim() === "" ? undefined : normalizeList(splitList(raw));
}

function getConfiguredMaxResults(): number {
  return configuredInteger(
    "GITHUB_TRENDING_MAX_RESULTS",
    DEFAULT_MAX_RESULTS,
    1,
    MAX_RESULTS_LIMIT,
  );
}

function getConfiguredMinStars(): number {
  return configuredInteger("GITHUB_TRENDING_MIN_STARS", DEFAULT_MIN_STARS, 0, 1_000_000_000);
}

function getConfiguredLookbackDays(): number {
  return configuredInteger("GITHUB_TRENDING_LOOKBACK_DAYS", DEFAULT_LOOKBACK_DAYS, 1, 365);
}

function configuredInteger(key: string, fallback: number, min: number, max: number): number {
  const raw = process.env[key];

  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new GitHubTrendingFetchError(
      `${key} must be an integer from ${min} to ${max}.`,
      "CONFIG",
    );
  }

  return parsed;
}

function splitList(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function normalizeList(entries: string[]): string[] | undefined {
  const values = [...new Set(entries.map((entry) => entry.trim()).filter((entry) => entry !== ""))];
  return values.length === 0 ? undefined : values;
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
