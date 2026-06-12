import { ItemKind, Locale, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { analyzePaperWithLlm, createLlmClient, type LlmClient } from "@/services/llm";
import type { PaperAnalysisResult } from "@/validators/llm";
import { summarizePaperSchema, type SummarizePaperInput } from "@/validators/summarization";

const PROMPT_VERSION = "analysis-v1";

const summarizedItemInclude = {
  paper: true,
  summaries: true,
} satisfies Prisma.ItemInclude;

type SummarizedPaperItem = Prisma.ItemGetPayload<{
  include: typeof summarizedItemInclude;
}>;

type PaperWithItem = Prisma.PaperGetPayload<{
  include: {
    item: true;
  };
}>;

export type BilingualPaperSummaryResult = {
  item: SummarizedPaperItem;
  analyses: {
    EN: PaperAnalysisResult;
    ZH: PaperAnalysisResult;
  };
};

export class PaperSummarizationError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "NOT_PAPER" | "MISSING_ABSTRACT" | "PERSIST_FAILED",
  ) {
    super(message);
    this.name = "PaperSummarizationError";
  }
}

export async function summarizePaper(
  input: SummarizePaperInput,
  client: LlmClient = createLlmClient(),
): Promise<BilingualPaperSummaryResult> {
  const data = summarizePaperSchema.parse(input);
  const paper = await getPaperForSummarization(data.itemId);

  if (paper.abstract === null || paper.abstract.trim() === "") {
    throw new PaperSummarizationError(
      "Paper must have an abstract before summarization.",
      "MISSING_ABSTRACT",
    );
  }

  const [enAnalysis, zhAnalysis] = await Promise.all([
    analyzePaperWithLlm(toPromptInput(paper, "EN"), client),
    analyzePaperWithLlm(toPromptInput(paper, "ZH"), client),
  ]);

  try {
    const item = await prisma.$transaction(async (tx) => {
      await tx.paper.update({
        where: {
          itemId: paper.itemId,
        },
        data: {
          problemStatement: enAnalysis.problem,
          methodology: enAnalysis.methodDesign,
          keyFindings: enAnalysis.experiments,
          limitations: enAnalysis.weaknesses.join("\n"),
          analysis: {
            promptVersion: PROMPT_VERSION,
            en: analysisToJson(enAnalysis),
            zh: analysisToJson(zhAnalysis),
          },
          relevanceScore: enAnalysis.relevance.score,
          relevanceNotes: enAnalysis.relevance.notes,
        },
      });

      await upsertGeneratedSummary(tx, paper.itemId, Locale.EN, enAnalysis);
      await upsertGeneratedSummary(tx, paper.itemId, Locale.ZH, zhAnalysis);

      return tx.item.findUniqueOrThrow({
        where: {
          id: paper.itemId,
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
    if (error instanceof PaperSummarizationError) {
      throw error;
    }

    throw new PaperSummarizationError(
      error instanceof Error ? error.message : "Unable to persist generated paper summaries.",
      "PERSIST_FAILED",
    );
  }
}

async function getPaperForSummarization(itemId: string): Promise<PaperWithItem> {
  const item = await prisma.item.findUnique({
    where: {
      id: itemId,
    },
    include: {
      paper: true,
    },
  });

  if (item === null) {
    throw new PaperSummarizationError(`Item ${itemId} was not found.`, "NOT_FOUND");
  }

  if (item.kind !== ItemKind.PAPER || item.paper === null) {
    throw new PaperSummarizationError(`Item ${itemId} is not a paper.`, "NOT_PAPER");
  }

  return prisma.paper.findUniqueOrThrow({
    where: {
      itemId,
    },
    include: {
      item: true,
    },
  });
}

function toPromptInput(paper: PaperWithItem, language: "EN" | "ZH") {
  return {
    title: paper.title,
    authors: paper.authors,
    venue: paper.venue,
    publishedAt: paper.publishedAt,
    revisedAt: paper.revisedAt,
    landingUrl: paper.landingUrl,
    pdfUrl: paper.pdfUrl,
    abstract: paper.abstract ?? "",
    language,
  };
}

async function upsertGeneratedSummary(
  tx: Prisma.TransactionClient,
  itemId: string,
  language: Locale,
  analysis: PaperAnalysisResult,
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

function analysisToJson(analysis: PaperAnalysisResult): Prisma.InputJsonValue {
  return {
    headline: analysis.headline,
    summary: analysis.summary,
    keyPoints: analysis.keyPoints,
    problem: analysis.problem,
    coreIdea: analysis.coreIdea,
    methodDesign: analysis.methodDesign,
    experiments: analysis.experiments,
    strengths: analysis.strengths,
    weaknesses: analysis.weaknesses,
    relevance: analysis.relevance,
  };
}
