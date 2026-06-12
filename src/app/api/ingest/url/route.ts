import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ingestUrl, IngestionError } from "@/services/ingestion";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await ingestUrl(body);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return ingestionErrorResponse(error, "single URL ingestion failed");
  }
}

function ingestionErrorResponse(error: unknown, context: string) {
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

  if (error instanceof IngestionError && error.code === "CONFLICT") {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  console.error(context, error);

  return NextResponse.json({ error: "Unable to ingest URL." }, { status: 502 });
}
