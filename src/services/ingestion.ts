import { ItemKind, type Prisma } from "@prisma/client";

import {
  extractArxivId,
  extractGitHubRepository,
  fetchArxivPaper,
  fetchGenericMetadata,
  fetchGitHubRepository,
  type ArxivPaperMetadata,
  type GenericWebMetadata,
  type GitHubRepositoryMetadata,
} from "@/fetchers";
import { prisma } from "@/lib/prisma";
import {
  ingestBatchUrlsSchema,
  ingestSingleUrlSchema,
  type IngestBatchUrlsInput,
  type IngestSingleUrlInput,
} from "@/validators/ingestion";

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

export type IngestionSource = "ARXIV" | "GITHUB" | "WEB";

export type IngestUrlResult = {
  url: string;
  source: IngestionSource;
  item: ItemWithRelations;
};

export type BatchIngestUrlResult =
  | {
      url: string;
      ok: true;
      source: IngestionSource;
      item: ItemWithRelations;
    }
  | {
      url: string;
      ok: false;
      error: string;
    };

export class IngestionError extends Error {
  constructor(
    message: string,
    readonly code: "CONFLICT" | "FETCH_FAILED" | "PERSIST_FAILED",
  ) {
    super(message);
    this.name = "IngestionError";
  }
}

export async function ingestUrl(input: IngestSingleUrlInput): Promise<IngestUrlResult> {
  const data = ingestSingleUrlSchema.parse(input);

  if (extractArxivId(data.url) !== null) {
    const metadata = await fetchArxivPaper(data.url);
    const item = await persistPaperFromArxiv(metadata, data.important);
    return { url: data.url, source: "ARXIV", item };
  }

  if (extractGitHubRepository(data.url) !== null) {
    const metadata = await fetchGitHubRepository(data.url);
    const item = await persistRepository(metadata, data.important);
    return { url: data.url, source: "GITHUB", item };
  }

  const metadata = await fetchGenericMetadata(data.url);
  const item = await persistPaperFromGeneric(metadata, data.important);
  return { url: data.url, source: "WEB", item };
}

export async function ingestBatchUrls(
  input: IngestBatchUrlsInput,
): Promise<{ results: BatchIngestUrlResult[] }> {
  const data = ingestBatchUrlsSchema.parse(input);
  const results: BatchIngestUrlResult[] = [];

  for (const url of data.urls) {
    try {
      const result = await ingestUrl({ url, important: data.important });
      results.push({
        url,
        ok: true,
        source: result.source,
        item: result.item,
      });
    } catch (error) {
      results.push({
        url,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown ingestion error.",
      });
    }
  }

  return { results };
}

async function persistPaperFromArxiv(
  metadata: ArxivPaperMetadata,
  important: boolean | undefined,
): Promise<ItemWithRelations> {
  return persistPaper({
    sourceUrl: metadata.sourceUrl,
    canonicalUrl: metadata.canonicalUrl,
    title: metadata.title,
    authors: metadata.authors,
    venue: metadata.venue,
    publishedAt: metadata.publishedAt,
    revisedAt: metadata.revisedAt,
    arxivId: metadata.arxivId,
    doi: metadata.doi,
    landingUrl: metadata.landingUrl,
    pdfUrl: metadata.pdfUrl,
    abstract: metadata.abstract,
    analysis: {
      source: "arxiv",
      categories: metadata.categories,
      primaryCategory: metadata.primaryCategory,
      version: metadata.version,
    },
    important,
  });
}

async function persistPaperFromGeneric(
  metadata: GenericWebMetadata,
  important: boolean | undefined,
): Promise<ItemWithRelations> {
  return persistPaper({
    sourceUrl: metadata.sourceUrl,
    canonicalUrl: metadata.canonicalUrl,
    title: metadata.title ?? metadata.canonicalUrl,
    authors: metadata.authors,
    venue: metadata.siteName,
    publishedAt: metadata.publishedAt,
    revisedAt: null,
    arxivId: null,
    doi: null,
    landingUrl: metadata.canonicalUrl,
    pdfUrl: metadata.pdfUrl,
    abstract: metadata.abstract ?? metadata.description,
    analysis: {
      source: "web",
      contentType: metadata.contentType,
      finalUrl: metadata.finalUrl,
      kind: metadata.kind,
    },
    important,
  });
}

async function persistPaper(input: {
  sourceUrl: string;
  canonicalUrl: string;
  title: string;
  authors: string[];
  venue: string | null;
  publishedAt: Date | null;
  revisedAt: Date | null;
  arxivId: string | null;
  doi: string | null;
  landingUrl: string | null;
  pdfUrl: string | null;
  abstract: string | null;
  analysis: Prisma.InputJsonValue;
  important: boolean | undefined;
}): Promise<ItemWithRelations> {
  return prisma.$transaction(async (tx) => {
    const item = await tx.item.upsert({
      where: { canonicalUrl: input.canonicalUrl },
      create: {
        kind: ItemKind.PAPER,
        sourceUrl: input.sourceUrl,
        canonicalUrl: input.canonicalUrl,
        important: input.important ?? false,
        archived: false,
      },
      update: {
        sourceUrl: input.sourceUrl,
        ...(input.important === undefined ? {} : { important: input.important }),
      },
    });

    if (item.kind !== ItemKind.PAPER) {
      throw new IngestionError(
        `URL ${input.canonicalUrl} is already stored as a non-paper item.`,
        "CONFLICT",
      );
    }

    await tx.paper.upsert({
      where: { itemId: item.id },
      create: {
        itemId: item.id,
        title: input.title,
        authors: input.authors,
        venue: input.venue,
        publishedAt: input.publishedAt,
        revisedAt: input.revisedAt,
        arxivId: input.arxivId,
        doi: input.doi,
        landingUrl: input.landingUrl,
        pdfUrl: input.pdfUrl,
        abstract: input.abstract,
        analysis: input.analysis,
      },
      update: {
        title: input.title,
        authors: input.authors,
        venue: input.venue,
        publishedAt: input.publishedAt,
        revisedAt: input.revisedAt,
        arxivId: input.arxivId,
        doi: input.doi,
        landingUrl: input.landingUrl,
        pdfUrl: input.pdfUrl,
        abstract: input.abstract,
        analysis: input.analysis,
      },
    });

    return tx.item.findUniqueOrThrow({
      where: { id: item.id },
      include: itemInclude,
    });
  });
}

async function persistRepository(
  metadata: GitHubRepositoryMetadata,
  important: boolean | undefined,
): Promise<ItemWithRelations> {
  return prisma.$transaction(async (tx) => {
    const item = await tx.item.upsert({
      where: { canonicalUrl: metadata.canonicalUrl },
      create: {
        kind: ItemKind.REPOSITORY,
        sourceUrl: metadata.sourceUrl,
        canonicalUrl: metadata.canonicalUrl,
        important: important ?? false,
        archived: false,
      },
      update: {
        sourceUrl: metadata.sourceUrl,
        ...(important === undefined ? {} : { important }),
      },
    });

    if (item.kind !== ItemKind.REPOSITORY) {
      throw new IngestionError(
        `URL ${metadata.canonicalUrl} is already stored as a non-repository item.`,
        "CONFLICT",
      );
    }

    await tx.repository.upsert({
      where: { itemId: item.id },
      create: {
        itemId: item.id,
        name: metadata.name,
        url: metadata.url,
        owner: metadata.owner,
        description: metadata.description,
        stars: metadata.stars,
        forks: metadata.forks,
        primaryLanguage: metadata.primaryLanguage,
        lastUpdatedAt: metadata.lastUpdatedAt,
        readme: metadata.readme,
        techStack: metadata.primaryLanguage === null ? [] : [metadata.primaryLanguage],
        installDifficulty: "UNKNOWN",
        researchValueScore: null,
        researchValueNotes: null,
      },
      update: {
        name: metadata.name,
        url: metadata.url,
        owner: metadata.owner,
        description: metadata.description,
        stars: metadata.stars,
        forks: metadata.forks,
        primaryLanguage: metadata.primaryLanguage,
        lastUpdatedAt: metadata.lastUpdatedAt,
        readme: metadata.readme,
        techStack: metadata.primaryLanguage === null ? [] : [metadata.primaryLanguage],
      },
    });

    return tx.item.findUniqueOrThrow({
      where: { id: item.id },
      include: itemInclude,
    });
  });
}
