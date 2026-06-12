import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { exportMarkdownForDay } from "@/services/markdown-export";

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const result = await exportMarkdownForDay({
      ...Object.fromEntries(searchParams.entries()),
      language: exportLanguageFromSearchParams(searchParams),
    });

    return new NextResponse(result.markdown, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Type": "text/markdown; charset=utf-8",
      },
    });
  } catch (error) {
    return markdownExportErrorResponse(error);
  }
}

function exportLanguageFromSearchParams(searchParams: URLSearchParams): "EN" | "ZH" | undefined {
  const language = searchParams.get("language");

  if (language === "EN" || language === "ZH") {
    return language;
  }

  return undefined;
}

function markdownExportErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid Markdown export request.",
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  console.error("Markdown export failed", error);
  return NextResponse.json({ error: "Unable to export Markdown." }, { status: 500 });
}
