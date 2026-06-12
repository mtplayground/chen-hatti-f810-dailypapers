import { ItemKind, type Prisma } from "@prisma/client";
import { z } from "zod";

import {
  fetchHuggingFaceDailyPapers,
  type HuggingFaceDailyPaperMetadata,
} from "@/fetchers/huggingface";
import { prisma } from "@/lib/prisma";
import { type AutoSummarizationResult } from "@/services/ingestion";
import { summarizePaper } from "@/services/paper-summarization";

const DEFAULT_MAX_RESULTS = 5;
const MAX_RESULTS_LIMIT = 50;

const optionalBooleanSchema = z.preprocess(booleanValue, z.boolean().optional());
const defaultTrueBooleanSchema = z.preprocess(booleanValue, z.boolean().default(true));
const defaultFalseBooleanSchema = z.preprocess(booleanValue, z.boolean().default(false));

const huggingFaceDailyFetchSchema = z.object({
  maxResults: z.coerce.number().int().min(1).max(MAX_RESULTS_LIMIT).optional(),
  important: optionalBooleanSchema,
  autoSummarize: defaultTrueBooleanSchema,
  dryRun: defaultFalseBooleanSchema,
});

export type HuggingFaceDailyFetchInput = z.input<typeof huggingFaceDailyFetchSchema>;
type HuggingFaceDailyFetchData = z.output<typeof huggingFaceDailyFetchSchema>;

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

export type HuggingFaceDailyFetchResult = {
  maxResults: number;
  dryRun: boolean;
  fetched: number;
  ingested: number;
  skipped: number;
  failed: number;
  results: HuggingFaceDailyFetchItemResult[];
};

export type HuggingFaceDailyFetchItemResult =
  | {
      hfPaperId: string;
      arxivId: string | null;
      title: string;
      url: string;
      hfLikes: number;
      hfRank: number;
      status: "SKIPPED_EXISTING";
      itemId: string;
    }
  | {
      hfPaperId: string;
      arxivId: string | null;
      title: string;
      url: string;
      hfLikes: number;
      hfRank: number;
      status: "DRY_RUN";
    }
  | {
      hfPaperId: string;
      arxivId: string | null;
      title: string;
      url: string;
      hfLikes: number;
      hfRank: number;
      status: "INGESTED";
      itemId: string;
      summary: AutoSummarizationResult | null;
    }
  | {
      hfPaperId: string;
      arxivId: string | null;
      title: string;
      url: string;
      hfLikes: number;
      hfRank: number;
      status: "FAILED";
      error: string;
    };

export class HuggingFaceDailyFetchError extends Error {
  constructor(
    message: string,
    readonly code: "FETCH_FAILED",
  ) {
    super(message);
    this.name = "HuggingFaceDailyFetchError";
  }
}

export async function fetchHuggingFaceDailyTopPapers(
  input: HuggingFaceDailyFetchInput = {},
): Promise<HuggingFaceDailyFetchResult> {
  const data = huggingFaceDailyFetchSchema.parse(input);
  const maxResults = data.maxResults ?? DEFAULT_MAX_RESULTS;
  const papers = await fetchDailyPapers(maxResults);
  const results: HuggingFaceDailyFetchItemResult[] = [];

  for (const paper of papers) {
    results.push(await processPaper(paper, data));
  }

  return {
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

async function fetchDailyPapers(maxResults: number): Promise<HuggingFaceDailyPaperMetadata[]> {
  try {
    return await fetchHuggingFaceDailyPapers({ maxResults });
  } catch (error) {
    throw new HuggingFaceDailyFetchError(
      error instanceof Error ? error.message : "Unable to fetch Hugging Face Daily Papers.",
      "FETCH_FAILED",
    );
  }
}

async function processPaper(
  paper: HuggingFaceDailyPaperMetadata,
  data: HuggingFaceDailyFetchData,
): Promise<HuggingFaceDailyFetchItemResult> {
  try {
    const existingItem = await findExistingPaperItem(paper);

    if (existingItem !== null) {
      return {
        ...resultBase(paper),
        status: "SKIPPED_EXISTING",
        itemId: existingItem.id,
      };
    }

    if (data.dryRun) {
      return {
        ...resultBase(paper),
        status: "DRY_RUN",
      };
    }

    const item = await persistHuggingFacePaper(paper, data.important);
    const summary = await maybeSummarizePaper(item, data.autoSummarize);

    return {
      ...resultBase(paper),
      status: "INGESTED",
      itemId: summary?.ok ? summary.item.id : item.id,
      summary,
    };
  } catch (error) {
    return {
      ...resultBase(paper),
      status: "FAILED",
      error: error instanceof Error ? error.message : "Unknown Hugging Face daily fetch error.",
    };
  }
}

async function findExistingPaperItem(paper: HuggingFaceDailyPaperMetadata) {
  return prisma.item.findFirst({
    where: {
      OR: [
        { canonicalUrl: paper.canonicalUrl },
        ...(paper.arxivId === null ? [] : [{ paper: { is: { arxivId: paper.arxivId } } }]),
      ],
    },
    select: {
      id: true,
    },
  });
}

async function persistHuggingFacePaper(
  paper: HuggingFaceDailyPaperMetadata,
  important: boolean | undefined,
): Promise<ItemWithRelations> {
  return prisma.$transaction(async (tx) => {
    const item = await tx.item.upsert({
      where: {
        canonicalUrl: paper.canonicalUrl,
      },
      create: {
        kind: ItemKind.PAPER,
        sourceUrl: paper.sourceUrl,
        canonicalUrl: paper.canonicalUrl,
        important: important ?? false,
        archived: false,
      },
      update: {
        sourceUrl: paper.sourceUrl,
        ...(important === undefined ? {} : { important }),
      },
    });

    if (item.kind !== ItemKind.PAPER) {
      throw new HuggingFaceDailyFetchError(
        `URL ${paper.canonicalUrl} is already stored as a non-paper item.`,
        "FETCH_FAILED",
      );
    }

    await tx.paper.upsert({
      where: {
        itemId: item.id,
      },
      create: paperFields(item.id, paper),
      update: paperFields(undefined, paper),
    });

    return tx.item.findUniqueOrThrow({
      where: {
        id: item.id,
      },
      include: itemInclude,
    });
  });
}

function paperFields(itemId: string | undefined, paper: HuggingFaceDailyPaperMetadata) {
  return {
    ...(itemId === undefined ? {} : { itemId }),
    title: paper.title,
    authors: paper.authors,
    venue: "Hugging Face Daily Papers",
    publishedAt: paper.publishedAt,
    revisedAt: paper.revisedAt,
    arxivId: paper.arxivId,
    doi: null,
    landingUrl: paper.landingUrl,
    pdfUrl: paper.pdfUrl,
    abstract: paper.abstract,
    analysis: analysisJson(paper),
  } satisfies Prisma.PaperUncheckedCreateInput | Prisma.PaperUncheckedUpdateInput;
}

async function maybeSummarizePaper(
  item: ItemWithRelations,
  autoSummarize: boolean,
): Promise<AutoSummarizationResult | null> {
  if (!autoSummarize) {
    return null;
  }

  try {
    const result = await summarizePaper({ itemId: item.id });
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
      error: error instanceof Error ? error.message : "Unknown paper summarization error.",
    };
  }
}

function resultBase(paper: HuggingFaceDailyPaperMetadata) {
  return {
    hfPaperId: paper.hfPaperId,
    arxivId: paper.arxivId,
    title: paper.title,
    url: paper.landingUrl,
    hfLikes: paper.hfLikes,
    hfRank: paper.hfRank,
  };
}

function analysisJson(paper: HuggingFaceDailyPaperMetadata): Prisma.InputJsonObject {
  return {
    source: "huggingface-daily",
    hfPaperId: paper.hfPaperId,
    hfLikes: paper.hfLikes,
    hfRank: paper.hfRank,
    hfSubmittedAt: paper.hfSubmittedAt?.toISOString() ?? null,
    hfSummary: paper.hfSummary,
    hfKeywords: paper.hfKeywords,
    projectPage: paper.projectPage,
    githubRepo: paper.githubRepo,
    sourceUrl: paper.sourceUrl,
    arxivId: paper.arxivId,
    version: paper.version,
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
