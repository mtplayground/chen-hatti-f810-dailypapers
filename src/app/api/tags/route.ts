import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { createTag, listTags } from "@/services/tags";

export async function GET() {
  try {
    const tags = await listTags();

    return NextResponse.json({ tags }, { status: 200 });
  } catch (error) {
    console.error("tag listing failed", error);
    return NextResponse.json({ error: "Unable to load tags." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tag = await createTag(body);

    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    return tagCreationErrorResponse(error);
  }
}

function tagCreationErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid tag request.",
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json({ error: "Tag slug already exists." }, { status: 409 });
  }

  console.error("tag creation failed", error);
  return NextResponse.json({ error: "Unable to create tag." }, { status: 500 });
}
