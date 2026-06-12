import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  fetchGitHubTrendingRepositories,
  GitHubTrendingFetchError,
} from "@/services/github-trending-fetch";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  return runTrendingFetch(Object.fromEntries(searchParams.entries()));
}

export async function POST(request: Request) {
  try {
    return runTrendingFetch(await requestBody(request));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    console.error("GitHub trending fetch request parsing failed", error);
    return NextResponse.json(
      { error: "Unable to parse GitHub trending fetch request." },
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

async function runTrendingFetch(input: unknown) {
  try {
    const result = await fetchGitHubTrendingRepositories(input);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return trendingFetchErrorResponse(error);
  }
}

function trendingFetchErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid GitHub trending fetch request.",
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  if (error instanceof GitHubTrendingFetchError) {
    const status = error.code === "CONFIG" ? 400 : 502;
    console.error("GitHub trending fetch failed", error);
    return NextResponse.json({ error: error.message }, { status });
  }

  console.error("GitHub trending fetch failed", error);
  return NextResponse.json({ error: "Unable to run GitHub trending fetch." }, { status: 500 });
}
