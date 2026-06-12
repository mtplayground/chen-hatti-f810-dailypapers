import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { exportItemsAsJson } from "@/services/portable-export";

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const result = await exportItemsAsJson(Object.fromEntries(searchParams.entries()));

    return NextResponse.json(result.payload, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error) {
    return portableExportErrorResponse(error, "JSON");
  }
}

function portableExportErrorResponse(error: unknown, format: string) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: `Invalid ${format} export request.`,
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  console.error(`${format} export failed`, error);
  return NextResponse.json({ error: `Unable to export ${format}.` }, { status: 500 });
}
