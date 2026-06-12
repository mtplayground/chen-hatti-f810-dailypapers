import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { MarkdownImportError, importMarkdownItems } from "@/services/markdown-import";

export async function POST(request: Request) {
  try {
    const body = await markdownBodyFromRequest(request);
    const result = await importMarkdownItems(body);

    return NextResponse.json(result, { status: 207 });
  } catch (error) {
    return markdownImportErrorResponse(error);
  }
}

async function markdownBodyFromRequest(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const markdown = await markdownFromFormData(formData);

    return {
      markdown,
      important: booleanFromFormValue(formData.get("important")),
    };
  }

  return request.json();
}

async function markdownFromFormData(formData: FormData): Promise<string> {
  const file = formData.get("file");
  const markdown = formData.get("markdown");

  if (file instanceof File) {
    return file.text();
  }

  if (typeof markdown === "string") {
    return markdown;
  }

  return "";
}

function booleanFromFormValue(value: FormDataEntryValue | null): boolean | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  if (value === "true" || value === "1" || value === "on") {
    return true;
  }

  if (value === "false" || value === "0" || value === "off") {
    return false;
  }

  return undefined;
}

function markdownImportErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid Markdown import request.",
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  if (error instanceof MarkdownImportError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  console.error("Markdown import failed", error);

  return NextResponse.json({ error: "Unable to import Markdown." }, { status: 502 });
}
