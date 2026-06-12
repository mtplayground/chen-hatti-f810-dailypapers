import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { DailyArxivFetchError, fetchDailyArxivPapers } from "@/services/arxiv-daily-fetch";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  return runDailyFetch(Object.fromEntries(searchParams.entries()));
}

export async function POST(request: Request) {
  try {
    return runDailyFetch(await requestBody(request));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    console.error("arXiv daily fetch request parsing failed", error);
    return NextResponse.json(
      { error: "Unable to parse arXiv daily fetch request." },
      { status: 500 },
    );
  }
}

async function requestBody(request: Request): Promise<unknown> {
  const body = await request.text();

  if (body.trim() === "") {
    return {};
  }

  return JSON.parse(body);
}

async function runDailyFetch(input: unknown) {
  try {
    const result = await fetchDailyArxivPapers(input);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return dailyFetchErrorResponse(error);
  }
}

function dailyFetchErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid arXiv daily fetch request.",
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  if (error instanceof DailyArxivFetchError) {
    const status = error.code === "CONFIG" ? 400 : 502;
    console.error("arXiv daily fetch failed", error);
    return NextResponse.json({ error: error.message }, { status });
  }

  console.error("arXiv daily fetch failed", error);
  return NextResponse.json({ error: "Unable to run arXiv daily fetch." }, { status: 500 });
}
