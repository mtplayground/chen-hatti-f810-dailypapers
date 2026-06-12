import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { deleteNote, listNotes, upsertNote } from "@/services/notes";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const language = noteLanguageFromRequest(request);
    const notes = await listNotes({ itemId: id, language });

    return NextResponse.json({ notes }, { status: 200 });
  } catch (error) {
    return noteErrorResponse(error, "Unable to load notes.");
  }
}

function noteLanguageFromRequest(request: Request): "EN" | "ZH" | undefined {
  const language = new URL(request.url).searchParams.get("language");

  if (language === "EN" || language === "ZH") {
    return language;
  }

  return undefined;
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const note = await upsertNote({ ...body, itemId: id });

    return NextResponse.json({ note }, { status: 200 });
  } catch (error) {
    return noteErrorResponse(error, "Unable to save note.");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const note = await deleteNote({ ...body, itemId: id });

    return NextResponse.json({ note }, { status: 200 });
  } catch (error) {
    return noteErrorResponse(error, "Unable to delete note.");
  }
}

function noteErrorResponse(error: unknown, message: string) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid note request.",
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }

  console.error("note API failed", error);
  return NextResponse.json({ error: message }, { status: 500 });
}
