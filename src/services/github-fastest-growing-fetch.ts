import { ItemKind, type Prisma } from "@prisma/client";
import { z } from "zod";

import {
  searchGitHubTrendingRepositories,
  type GitHubRepositorySearchResult,
} from "@/fetchers/github";
import { prisma } from "@/lib/prisma";
import { type AutoSummarizationResult } from "@/services/ingestion";
import { summarizeRepository } from "@/services/repository-summarization";

const DEFAULT_MAX_RESULTS = 5;
const MAX_RESULTS_LIMIT = 50;
const DEFAULT_LOOKBACK_DAYS = 7;
const DEFAULT_CANDIDATE_LIMIT = 25;
const CANDIDATE_LIMIT_MAX = 100;

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

const githubFastestGrowingFetchSchema = z
  .object({
    keywords: listSchema,
    topics: listSchema,
    maxResults: z.coerce.number().int().min(1).max(MAX_RESULTS_LIMIT).optional(),
    candidateLimit: z.coerce.number().int().min(1).max(CANDIDATE_LIMIT_MAX).optional(),
    lookbackDays: z.coerce.number().int().min(1).max(365).optional(),
    createdAfter: z.coerce.date().optional(),
    pushedAfter: z.coerce.date().optional(),
    date: dateStringSchema.optional(),
    important: optionalBooleanSchema,
    autoSummarize: defaultTrueBooleanSchema,
    dryRun: defaultFalseBooleanSchema,
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

export type GitHubFastestGrowingFetchInput = z.input<typeof githubFastestGrowingFetchSchema>;
type GitHubFastestGrowingFetchData = z.output<typeof githubFastestGrowingFetchSchema>;

const itemInclude = {
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

type ItemWithRelations = Prisma.ItemGetPayload<{
  include: typeof itemInclude;
}>;

export type GitHubFastestGrowingFetchResult = {
  keywords: string[];
  topics: string[];
  createdAfter: string;
  pushedAfter: string;
  maxResults: number;
  candidateLimit: number;
  dryRun: boolean;
  fetched: number;
  ingested: number;
  updated: number;
  skipped: number;
  failed: number;
  results: GitHubFastestGrowingFetchItemResult[];
};

export type GitHubFastestGrowingFetchItemResult =
  | (GitHubFastestGrowingBaseResult & {
      status: "DRY_RUN";
    })
  | (GitHubFastestGrowingBaseResult & {
      status: "INGESTED" | "UPDATED";
      itemId: string;
      summary: AutoSummarizationResult | null;
    })
  | (GitHubFastestGrowingBaseResult & {
      status: "FAILED";
      error: string;
    });

type GitHubFastestGrowingBaseResult = {
  repository: string;
  url: string;
  stars: number;
  pushedAt: string | null;
  lastUpdatedAt: string | null;
};

export class GitHubFastestGrowingFetchError extends Error {
  constructor(
    message: string,
    readonly code: "FETCH_FAILED" | "PERSIST_FAILED" | "CONFIG",
  ) {
    super(message);
    this.name = "GitHubFastestGrowingFetchError";
  }
}

export async function fetchGitHubFastestGrowingRepositories(
  input: GitHubFastestGrowingFetchInput = {},
): Promise<GitHubFastestGrowingFetchResult> {
  const data = githubFastestGrowingFetchSchema.parse(input);
  const maxResults =
    data.maxResults ??
    configuredInteger("GITHUB_FAST_GROWING_MAX_RESULTS", DEFAULT_MAX_RESULTS, 1, MAX_RESULTS_LIMIT);
  const candidateLimit =
    data.candidateLimit ??
    configuredInteger(
      "GITHUB_FAST_GROWING_CANDIDATE_LIMIT",
      Math.max(DEFAULT_CANDIDATE_LIMIT, maxResults),
      maxResults,
      CANDIDATE_LIMIT_MAX,
    );
  const dates = windowDates(data);
  const keywords = data.keywords ?? [];
  const topics = data.topics ?? [];
  const candidates = await searchFastestGrowingCandidates(
    keywords,
    topics,
    candidateLimit,
    dates.createdAfter,
    dates.pushedAfter,
  );
  const repositories = selectTopRepositories(candidates, maxResults);
  const results: GitHubFastestGrowingFetchItemResult[] = [];

  for (const repository of repositories) {
    results.push(await processRepository(repository, data));
  }

  return {
    keywords,
    topics,
    createdAfter: dates.createdAfter.toISOString(),
    pushedAfter: dates.pushedAfter.toISOString(),
    maxResults,
    candidateLimit,
    dryRun: data.dryRun,
    fetched: repositories.length,
    ingested: results.filter((result) => result.status === "INGESTED").length,
    updated: results.filter((result) => result.status === "UPDATED").length,
    skipped: results.filter((result) => result.status === "DRY_RUN").length,
    failed: results.filter((result) => result.status === "FAILED").length,
    results,
  };
}

async function searchFastestGrowingCandidates(
  keywords: string[],
  topics: string[],
  candidateLimit: number,
  createdAfter: Date,
  pushedAfter: Date,
): Promise<GitHubRepositorySearchResult[]> {
  try {
    return await searchGitHubTrendingRepositories({
      keywords,
      topics,
      maxResults: candidateLimit,
      createdAfter,
      pushedAfter,
    });
  } catch (error) {
    throw new GitHubFastestGrowingFetchError(
      error instanceof Error
        ? error.message
        : "Unable to fetch GitHub fastest-growing repository candidates.",
      "FETCH_FAILED",
    );
  }
}

async function processRepository(
  repository: GitHubRepositorySearchResult,
  data: GitHubFastestGrowingFetchData,
): Promise<GitHubFastestGrowingFetchItemResult> {
  try {
    if (data.dryRun) {
      return {
        ...resultBase(repository),
        status: "DRY_RUN",
      };
    }

    const existingItem = await findExistingRepositoryItem(repository);
    const item = await persistRepository(repository, existingItem?.id ?? null, data.important);
    const summary = await maybeSummarizeRepository(item, data.autoSummarize);

    return {
      ...resultBase(repository),
      status: existingItem === null ? "INGESTED" : "UPDATED",
      itemId: summary?.ok ? summary.item.id : item.id,
      summary,
    };
  } catch (error) {
    return {
      ...resultBase(repository),
      status: "FAILED",
      error: error instanceof Error ? error.message : "Unknown GitHub fastest-growing fetch error.",
    };
  }
}

async function findExistingRepositoryItem(repository: GitHubRepositorySearchResult) {
  return prisma.item.findFirst({
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
}

async function persistRepository(
  repository: GitHubRepositorySearchResult,
  existingItemId: string | null,
  important: boolean | undefined,
): Promise<ItemWithRelations> {
  return prisma.$transaction(async (tx) => {
    const item =
      existingItemId === null
        ? await tx.item.create({
            data: {
              kind: ItemKind.REPOSITORY,
              sourceUrl: repository.url,
              canonicalUrl: repository.canonicalUrl,
              important: important ?? false,
              archived: false,
            },
          })
        : await tx.item.update({
            where: {
              id: existingItemId,
            },
            data: {
              sourceUrl: repository.url,
              canonicalUrl: repository.canonicalUrl,
              ...(important === undefined ? {} : { important }),
            },
          });

    if (item.kind !== ItemKind.REPOSITORY) {
      throw new GitHubFastestGrowingFetchError(
        `URL ${repository.canonicalUrl} is already stored as a non-repository item.`,
        "PERSIST_FAILED",
      );
    }

    await tx.repository.upsert({
      where: {
        itemId: item.id,
      },
      create: repositoryFields(item.id, repository),
      update: repositoryFields(undefined, repository),
    });

    return tx.item.findUniqueOrThrow({
      where: {
        id: item.id,
      },
      include: itemInclude,
    });
  });
}

function repositoryFields(itemId: string | undefined, repository: GitHubRepositorySearchResult) {
  return {
    ...(itemId === undefined ? {} : { itemId }),
    name: repository.name,
    url: repository.url,
    owner: repository.owner,
    description: repository.description,
    stars: repository.stars,
    forks: repository.forks,
    primaryLanguage: repository.primaryLanguage,
    lastUpdatedAt: repository.lastUpdatedAt,
    techStack: repository.primaryLanguage === null ? [] : [repository.primaryLanguage],
  } satisfies Prisma.RepositoryUncheckedCreateInput | Prisma.RepositoryUncheckedUpdateInput;
}

async function maybeSummarizeRepository(
  item: ItemWithRelations,
  autoSummarize: boolean,
): Promise<AutoSummarizationResult | null> {
  if (!autoSummarize) {
    return null;
  }

  try {
    const result = await summarizeRepository({ itemId: item.id });
    const summarizedItem = await prisma.item.findUniqueOrThrow({
      where: {
        id: result.item.id,
      },
      include: itemInclude,
    });

    return {
      ok: true,
      item: summarizedItem,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown repository summarization error.",
    };
  }
}

function selectTopRepositories(
  repositories: GitHubRepositorySearchResult[],
  maxResults: number,
): GitHubRepositorySearchResult[] {
  return [...repositories]
    .sort((left, right) => {
      const starDelta = right.stars - left.stars;

      if (starDelta !== 0) {
        return starDelta;
      }

      return dateMillis(right.pushedAt) - dateMillis(left.pushedAt);
    })
    .slice(0, maxResults);
}

function resultBase(repository: GitHubRepositorySearchResult): GitHubFastestGrowingBaseResult {
  return {
    repository: repository.fullName,
    url: repository.url,
    stars: repository.stars,
    pushedAt: repository.pushedAt?.toISOString() ?? null,
    lastUpdatedAt: repository.lastUpdatedAt?.toISOString() ?? null,
  };
}

function windowDates(data: GitHubFastestGrowingFetchData): {
  createdAfter: Date;
  pushedAfter: Date;
} {
  if (data.date !== undefined) {
    const date = new Date(`${data.date}T00:00:00.000Z`);
    return {
      createdAfter: date,
      pushedAfter: date,
    };
  }

  const fallback = new Date(
    Date.now() -
      (data.lookbackDays ??
        configuredInteger("GITHUB_FAST_GROWING_LOOKBACK_DAYS", DEFAULT_LOOKBACK_DAYS, 1, 365)) *
        24 *
        60 *
        60 *
        1000,
  );

  return {
    createdAfter: data.createdAfter ?? fallback,
    pushedAfter: data.pushedAfter ?? fallback,
  };
}

function configuredInteger(key: string, fallback: number, min: number, max: number): number {
  const raw = process.env[key];

  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new GitHubFastestGrowingFetchError(
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

  if (["true", "1", "yes", "on"].includes(value.toLowerCase())) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(value.toLowerCase())) {
    return false;
  }

  return value;
}

function isValidDateKey(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dateMillis(date: Date | null): number {
  return date?.getTime() ?? 0;
}
