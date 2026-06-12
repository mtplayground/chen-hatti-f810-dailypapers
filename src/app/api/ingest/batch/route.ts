import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ingestBatchUrls } from "@/services/ingestion";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await ingestBatchUrls(body);

    return NextResponse.json(result, { status: 207 });
  } catch (error) {
    return batchIngestionErrorResponse(error);
  }
}

function batchIngestionErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid request body.",
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  console.error("batch URL ingestion failed", error);

  return NextResponse.json({ error: "Unable to ingest URLs." }, { status: 502 });
}
