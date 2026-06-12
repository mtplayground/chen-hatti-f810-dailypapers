import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { LlmClientError, LlmConfigError } from "@/services/llm";
import { PaperSummarizationError, summarizePaper } from "@/services/paper-summarization";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await summarizePaper({ itemId: id });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return summarizePaperErrorResponse(error);
  }
}

function summarizePaperErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid paper id.",
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  if (error instanceof PaperSummarizationError) {
    if (error.code === "NOT_FOUND") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error.code === "NOT_PAPER" || error.code === "MISSING_ABSTRACT") {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    console.error("paper summarization persistence failed", error);
    return NextResponse.json({ error: "Unable to persist paper summary." }, { status: 500 });
  }

  if (error instanceof LlmConfigError) {
    console.error("paper summarization LLM configuration failed", error);
    return NextResponse.json({ error: "LLM is not configured." }, { status: 500 });
  }

  if (error instanceof LlmClientError) {
    console.error("paper summarization LLM request failed", error);
    return NextResponse.json({ error: "Unable to generate paper summary." }, { status: 502 });
  }

  console.error("paper summarization failed", error);
  return NextResponse.json({ error: "Unable to summarize paper." }, { status: 500 });
}
