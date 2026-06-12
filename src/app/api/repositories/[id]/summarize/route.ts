import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { LlmClientError, LlmConfigError } from "@/services/llm";
import {
  RepositorySummarizationError,
  summarizeRepository,
} from "@/services/repository-summarization";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await summarizeRepository({ itemId: id });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return summarizeRepositoryErrorResponse(error);
  }
}

function summarizeRepositoryErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid repository id.",
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  if (error instanceof RepositorySummarizationError) {
    if (error.code === "NOT_FOUND") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error.code === "NOT_REPOSITORY" || error.code === "MISSING_METADATA") {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    console.error("repository summarization persistence failed", error);
    return NextResponse.json({ error: "Unable to persist repository summary." }, { status: 500 });
  }

  if (error instanceof LlmConfigError) {
    console.error("repository summarization LLM configuration failed", error);
    return NextResponse.json({ error: "LLM is not configured." }, { status: 500 });
  }

  if (error instanceof LlmClientError) {
    console.error("repository summarization LLM request failed", error);
    return NextResponse.json({ error: "Unable to generate repository summary." }, { status: 502 });
  }

  console.error("repository summarization failed", error);
  return NextResponse.json({ error: "Unable to summarize repository." }, { status: 500 });
}
