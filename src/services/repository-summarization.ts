import { ItemKind, Locale, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { analyzeRepositoryWithLlm, createLlmClient, type LlmClient } from "@/services/llm";
import type { RepositoryAnalysisResult } from "@/validators/llm";
import {
  summarizeRepositorySchema,
  type SummarizeRepositoryInput,
} from "@/validators/summarization";

const PROMPT_VERSION = "analysis-v1";

const summarizedItemInclude = {
  repository: true,
  summaries: true,
} satisfies Prisma.ItemInclude;

type SummarizedRepositoryItem = Prisma.ItemGetPayload<{
  include: typeof summarizedItemInclude;
}>;

type RepositoryWithItem = Prisma.RepositoryGetPayload<{
  include: {
    item: true;
  };
}>;

export type BilingualRepositorySummaryResult = {
  item: SummarizedRepositoryItem;
  analyses: {
    EN: RepositoryAnalysisResult;
    ZH: RepositoryAnalysisResult;
  };
};

export class RepositorySummarizationError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "NOT_REPOSITORY" | "MISSING_METADATA" | "PERSIST_FAILED",
  ) {
    super(message);
    this.name = "RepositorySummarizationError";
  }
}

export async function summarizeRepository(
  input: SummarizeRepositoryInput,
  client: LlmClient = createLlmClient(),
): Promise<BilingualRepositorySummaryResult> {
  const data = summarizeRepositorySchema.parse(input);
  const repository = await getRepositoryForSummarization(data.itemId);

  if (!hasUsableMetadata(repository)) {
    throw new RepositorySummarizationError(
      "Repository must have a README or description before summarization.",
      "MISSING_METADATA",
    );
  }

  const [enAnalysis, zhAnalysis] = await Promise.all([
    analyzeRepositoryWithLlm(toPromptInput(repository, "EN"), client),
    analyzeRepositoryWithLlm(toPromptInput(repository, "ZH"), client),
  ]);

  try {
    const item = await prisma.$transaction(async (tx) => {
      await tx.repository.update({
        where: {
          itemId: repository.itemId,
        },
        data: {
          techStack: enAnalysis.techStack,
          installDifficulty: enAnalysis.installDifficulty,
          installNotes: enAnalysis.usage,
          researchValueScore: enAnalysis.usefulness.score,
          researchValueNotes: enAnalysis.usefulness.notes,
        },
      });

      await upsertGeneratedSummary(tx, repository.itemId, Locale.EN, enAnalysis);
      await upsertGeneratedSummary(tx, repository.itemId, Locale.ZH, zhAnalysis);

      return tx.item.findUniqueOrThrow({
        where: {
          id: repository.itemId,
        },
        include: summarizedItemInclude,
      });
    });

    return {
      item,
      analyses: {
        EN: enAnalysis,
        ZH: zhAnalysis,
      },
    };
  } catch (error) {
    if (error instanceof RepositorySummarizationError) {
      throw error;
    }

    throw new RepositorySummarizationError(
      error instanceof Error ? error.message : "Unable to persist generated repository summaries.",
      "PERSIST_FAILED",
    );
  }
}

async function getRepositoryForSummarization(itemId: string): Promise<RepositoryWithItem> {
  const item = await prisma.item.findUnique({
    where: {
      id: itemId,
    },
    include: {
      repository: true,
    },
  });

  if (item === null) {
    throw new RepositorySummarizationError(`Item ${itemId} was not found.`, "NOT_FOUND");
  }

  if (item.kind !== ItemKind.REPOSITORY || item.repository === null) {
    throw new RepositorySummarizationError(`Item ${itemId} is not a repository.`, "NOT_REPOSITORY");
  }

  return prisma.repository.findUniqueOrThrow({
    where: {
      itemId,
    },
    include: {
      item: true,
    },
  });
}

function hasUsableMetadata(repository: RepositoryWithItem): boolean {
  return (
    (repository.readme !== null && repository.readme.trim() !== "") ||
    (repository.description !== null && repository.description.trim() !== "")
  );
}

function toPromptInput(repository: RepositoryWithItem, language: "EN" | "ZH") {
  return {
    name: repository.name,
    owner: repository.owner,
    url: repository.url,
    description: repository.description,
    stars: repository.stars,
    forks: repository.forks,
    primaryLanguage: repository.primaryLanguage,
    lastUpdatedAt: repository.lastUpdatedAt,
    readme: repository.readme,
    language,
  };
}

async function upsertGeneratedSummary(
  tx: Prisma.TransactionClient,
  itemId: string,
  language: Locale,
  analysis: RepositoryAnalysisResult,
) {
  return tx.summary.upsert({
    where: {
      itemId_language: {
        itemId,
        language,
      },
    },
    create: {
      itemId,
      language,
      headline: analysis.headline,
      summary: analysis.summary,
      keyPoints: analysis.keyPoints,
      generatedBy: "llm",
      promptVersion: PROMPT_VERSION,
    },
    update: {
      headline: analysis.headline,
      summary: analysis.summary,
      keyPoints: analysis.keyPoints,
      generatedBy: "llm",
      promptVersion: PROMPT_VERSION,
      generatedAt: new Date(),
    },
  });
}
