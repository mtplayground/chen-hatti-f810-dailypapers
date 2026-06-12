import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { updateItemStatus } from "@/services/items";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const item = await updateItemStatus({ ...body, id });

    return NextResponse.json(
      {
        item: {
          id: item.id,
          important: item.important,
          archived: item.archived,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return itemStatusErrorResponse(error);
  }
}

function itemStatusErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid item status request.",
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  console.error("item status update failed", error);
  return NextResponse.json({ error: "Unable to update item status." }, { status: 500 });
}
