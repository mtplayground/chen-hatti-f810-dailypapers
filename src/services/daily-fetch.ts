import { z } from "zod";

import {
  fetchGitHubFastestGrowingRepositories,
  type GitHubFastestGrowingFetchInput,
  type GitHubFastestGrowingFetchResult,
} from "@/services/github-fastest-growing-fetch";
import {
  fetchHuggingFaceDailyTopPapers,
  type HuggingFaceDailyFetchInput,
  type HuggingFaceDailyFetchResult,
} from "@/services/huggingface-daily-fetch";

const MAX_RESULTS_LIMIT = 50;
const CANDIDATE_LIMIT_MAX = 100;

const optionalBooleanSchema = z.preprocess(booleanValue, z.boolean().optional());
const defaultTrueBooleanSchema = z.preprocess(booleanValue, z.boolean().default(true));
const defaultFalseBooleanSchema = z.preprocess(booleanValue, z.boolean().default(false));
const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();
const listSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    const values = (Array.isArray(value) ? value : value.split(/[\n,]+/))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    return values.length === 0 ? undefined : [...new Set(values)];
  });

const paperOptionsSchema = z.object({
  maxResults: z.coerce.number().int().min(1).max(MAX_RESULTS_LIMIT).optional(),
  important: optionalBooleanSchema,
  autoSummarize: optionalBooleanSchema,
  dryRun: optionalBooleanSchema,
});

const repositoryOptionsSchema = z
  .object({
    keywords: listSchema,
    topics: listSchema,
    maxResults: z.coerce.number().int().min(1).max(MAX_RESULTS_LIMIT).optional(),
    candidateLimit: z.coerce.number().int().min(1).max(CANDIDATE_LIMIT_MAX).optional(),
    lookbackDays: z.coerce.number().int().min(1).max(365).optional(),
    createdAfter: z.coerce.date().optional(),
    pushedAfter: z.coerce.date().optional(),
    date: dateStringSchema,
    important: optionalBooleanSchema,
    autoSummarize: optionalBooleanSchema,
    dryRun: optionalBooleanSchema,
  })
  .refine(
    (value) =>
      value.date === undefined ||
      (value.createdAfter === undefined && value.pushedAfter === undefined),
    {
      message: "Use either date or explicit createdAfter/pushedAfter values, not both.",
      path: ["date"],
    },
  );

const unifiedDailyFetchSchema = z.object({
  maxResults: z.coerce.number().int().min(1).max(MAX_RESULTS_LIMIT).optional(),
  papersMaxResults: z.coerce.number().int().min(1).max(MAX_RESULTS_LIMIT).optional(),
  repositoriesMaxResults: z.coerce.number().int().min(1).max(MAX_RESULTS_LIMIT).optional(),
  important: optionalBooleanSchema,
  autoSummarize: defaultTrueBooleanSchema,
  dryRun: defaultFalseBooleanSchema,
  repositoryKeywords: listSchema,
  repositoryTopics: listSchema,
  repositoryCandidateLimit: z.coerce.number().int().min(1).max(CANDIDATE_LIMIT_MAX).optional(),
  repositoryLookbackDays: z.coerce.number().int().min(1).max(365).optional(),
  repositoryCreatedAfter: z.coerce.date().optional(),
  repositoryPushedAfter: z.coerce.date().optional(),
  repositoryDate: dateStringSchema,
  papers: paperOptionsSchema.optional(),
  repositories: repositoryOptionsSchema.optional(),
});

export type UnifiedDailyFetchInput = z.input<typeof unifiedDailyFetchSchema>;
type UnifiedDailyFetchData = z.output<typeof unifiedDailyFetchSchema>;

export type UnifiedDailyFetchResult = {
  papers: UnifiedDailyFetchPapersResult;
  repositories: UnifiedDailyFetchRepositoriesResult;
};

export type UnifiedDailyFetchPapersResult =
  | (HuggingFaceDailyFetchResult & {
      source: "huggingface-daily";
      status: "fetched";
    })
  | {
      source: "huggingface-daily";
      status: "failed";
      fetched: 0;
      ingested: 0;
      skipped: 0;
      failed: 1;
      results: [];
      error: string;
    };

export type UnifiedDailyFetchRepositoriesResult =
  | (GitHubFastestGrowingFetchResult & {
      source: "github-fastest-growing";
      status: "fetched";
    })
  | {
      source: "github-fastest-growing";
      status: "failed";
      fetched: 0;
      ingested: 0;
      updated: 0;
      skipped: 0;
      failed: 1;
      results: [];
      error: string;
    };

export async function runUnifiedDailyFetch(input: unknown = {}): Promise<UnifiedDailyFetchResult> {
  const data = unifiedDailyFetchSchema.parse(input);
  const [papers, repositories] = await Promise.all([fetchPapers(data), fetchRepositories(data)]);

  return {
    papers,
    repositories,
  };
}

async function fetchPapers(data: UnifiedDailyFetchData): Promise<UnifiedDailyFetchPapersResult> {
  try {
    const result = await fetchHuggingFaceDailyTopPapers(paperInput(data));
    return {
      source: "huggingface-daily",
      status: "fetched",
      ...result,
    };
  } catch (error) {
    console.error("Unified daily fetch failed for Hugging Face Daily Papers", error);
    return {
      source: "huggingface-daily",
      status: "failed",
      fetched: 0,
      ingested: 0,
      skipped: 0,
      failed: 1,
      results: [],
      error: errorMessage(error),
    };
  }
}

async function fetchRepositories(
  data: UnifiedDailyFetchData,
): Promise<UnifiedDailyFetchRepositoriesResult> {
  try {
    const result = await fetchGitHubFastestGrowingRepositories(repositoryInput(data));
    return {
      source: "github-fastest-growing",
      status: "fetched",
      ...result,
    };
  } catch (error) {
    console.error("Unified daily fetch failed for GitHub fastest-growing repositories", error);
    return {
      source: "github-fastest-growing",
      status: "failed",
      fetched: 0,
      ingested: 0,
      updated: 0,
      skipped: 0,
      failed: 1,
      results: [],
      error: errorMessage(error),
    };
  }
}

function paperInput(data: UnifiedDailyFetchData): HuggingFaceDailyFetchInput {
  return {
    maxResults: data.papers?.maxResults ?? data.papersMaxResults ?? data.maxResults,
    important: data.papers?.important ?? data.important,
    autoSummarize: data.papers?.autoSummarize ?? data.autoSummarize,
    dryRun: data.papers?.dryRun ?? data.dryRun,
  };
}

function repositoryInput(data: UnifiedDailyFetchData): GitHubFastestGrowingFetchInput {
  return {
    keywords: data.repositories?.keywords ?? data.repositoryKeywords,
    topics: data.repositories?.topics ?? data.repositoryTopics,
    maxResults: data.repositories?.maxResults ?? data.repositoriesMaxResults ?? data.maxResults,
    candidateLimit: data.repositories?.candidateLimit ?? data.repositoryCandidateLimit,
    lookbackDays: data.repositories?.lookbackDays ?? data.repositoryLookbackDays,
    createdAfter: data.repositories?.createdAfter ?? data.repositoryCreatedAfter,
    pushedAfter: data.repositories?.pushedAfter ?? data.repositoryPushedAfter,
    date: data.repositories?.date ?? data.repositoryDate,
    important: data.repositories?.important ?? data.important,
    autoSummarize: data.repositories?.autoSummarize ?? data.autoSummarize,
    dryRun: data.repositories?.dryRun ?? data.dryRun,
  };
}

function booleanValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  if (["true", "1", "yes", "on"].includes(value.toLowerCase())) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(value.toLowerCase())) {
    return false;
  }

  return value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown daily fetch error.";
}
