import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { searchItems } from "@/services/search";

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const result = await searchItems(params);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return searchErrorResponse(error);
  }
}

function searchErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid search query.",
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  console.error("search query failed", error);

  return NextResponse.json({ error: "Unable to search items." }, { status: 500 });
}
