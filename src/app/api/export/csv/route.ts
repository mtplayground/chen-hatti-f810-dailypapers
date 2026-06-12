import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { exportItemsAsCsv } from "@/services/portable-export";

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const result = await exportItemsAsCsv({
      date: searchParams.get("date") ?? undefined,
    });

    return new NextResponse(result.csv, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    return portableExportErrorResponse(error, "CSV");
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
