import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { setItemTags } from "@/services/tags";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const item = await setItemTags({ ...body, itemId: id });

    return NextResponse.json(
      {
        tags: item.tags.map((itemTag) => itemTag.tag),
      },
      { status: 200 },
    );
  } catch (error) {
    return itemTagsErrorResponse(error);
  }
}

function itemTagsErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid tag assignment request.",
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  console.error("item tag assignment failed", error);
  return NextResponse.json({ error: "Unable to update item tags." }, { status: 500 });
}
