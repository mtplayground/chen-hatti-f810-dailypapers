import * as cheerio from "cheerio";

import { extractArxivId } from "@/fetchers/arxiv";
import {
  huggingFaceDailyPapersFetchInputSchema,
  type HuggingFaceDailyPapersFetchInput,
} from "@/validators/huggingface";

const HUGGINGFACE_DAILY_PAPERS_URL = "https://huggingface.co/papers";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

type UnknownRecord = Record<string, unknown>;

type HuggingFaceDailyPapersProps = {
  dailyPapers?: unknown;
  dateString?: unknown;
};

export type HuggingFaceDailyPaperMetadata = {
  arxivId: string | null;
  version: string | null;
  title: string;
  authors: string[];
  abstract: string | null;
  publishedAt: Date | null;
  revisedAt: Date | null;
  landingUrl: string;
  pdfUrl: string | null;
  sourceUrl: string;
  canonicalUrl: string;
  hfPaperId: string;
  hfLikes: number;
  hfRank: number;
  hfSubmittedAt: Date | null;
  hfSummary: string | null;
  hfKeywords: string[];
  projectPage: string | null;
  githubRepo: string | null;
};

export class HuggingFaceDailyPapersFetchError extends Error {
  constructor(
    message: string,
    readonly code: "UPSTREAM_ERROR" | "PARSE_ERROR",
  ) {
    super(message);
    this.name = "HuggingFaceDailyPapersFetchError";
  }
}

export async function fetchHuggingFaceDailyPapers(
  input: HuggingFaceDailyPapersFetchInput = {},
  options: { fetcher?: FetchLike; signal?: AbortSignal } = {},
): Promise<HuggingFaceDailyPaperMetadata[]> {
  const data = huggingFaceDailyPapersFetchInputSchema.parse(input);
  const fetcher = options.fetcher ?? fetch;
  const requestInit: RequestInit = {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "chen-hatti-f810-dailypapers/0.1 huggingface-daily-papers-fetcher",
    },
  };

  if (options.signal !== undefined) {
    requestInit.signal = options.signal;
  }

  const response = await fetcher(HUGGINGFACE_DAILY_PAPERS_URL, requestInit);

  if (!response.ok) {
    throw new HuggingFaceDailyPapersFetchError(
      `Hugging Face Daily Papers request failed with ${response.status} ${response.statusText}.`,
      "UPSTREAM_ERROR",
    );
  }

  return parseHuggingFaceDailyPapersHtml(
    await response.text(),
    response.url.length > 0 ? response.url : HUGGINGFACE_DAILY_PAPERS_URL,
  ).slice(0, data.maxResults);
}

export function parseHuggingFaceDailyPapersHtml(
  html: string,
  sourceUrl: string = HUGGINGFACE_DAILY_PAPERS_URL,
): HuggingFaceDailyPaperMetadata[] {
  const props = dailyPapersProps(html);
  const dailyPapers = arrayValue(props.dailyPapers);

  if (dailyPapers.length === 0) {
    throw new HuggingFaceDailyPapersFetchError(
      "Hugging Face Daily Papers page did not include any daily paper entries.",
      "PARSE_ERROR",
    );
  }

  const normalized = dailyPapers.map((entry, index) =>
    normalizeDailyPaper(entry, sourceUrl, index),
  );

  return normalized
    .sort((left, right) => {
      const attentionDelta = right.hfLikes - left.hfLikes;

      if (attentionDelta !== 0) {
        return attentionDelta;
      }

      return left.hfRank - right.hfRank;
    })
    .map((paper, index) => ({
      ...paper,
      hfRank: index + 1,
    }));
}

function dailyPapersProps(html: string): HuggingFaceDailyPapersProps {
  const $ = cheerio.load(html);
  const propsText = $(".SVELTE_HYDRATER[data-target='DailyPapers']").attr("data-props");

  if (propsText === undefined || propsText.trim() === "") {
    throw new HuggingFaceDailyPapersFetchError(
      "Hugging Face Daily Papers page is missing the DailyPapers data payload.",
      "PARSE_ERROR",
    );
  }

  try {
    return JSON.parse(propsText) as HuggingFaceDailyPapersProps;
  } catch (error) {
    throw new HuggingFaceDailyPapersFetchError(
      `Could not parse Hugging Face Daily Papers payload: ${
        error instanceof Error ? error.message : "unknown error"
      }.`,
      "PARSE_ERROR",
    );
  }
}

function normalizeDailyPaper(
  entry: unknown,
  pageUrl: string,
  originalIndex: number,
): HuggingFaceDailyPaperMetadata {
  const entryRecord = recordValue(entry);
  const paper = recordValue(entryRecord["paper"]);
  const hfPaperId = requiredText(paper["id"], "paper.id");
  const sourceUrl = absoluteUrl(`/papers/${hfPaperId}`, pageUrl);
  const arxivId = resolveArxivId(paper, sourceUrl);
  const idParts = arxivId === null ? null : splitArxivVersion(arxivId);
  const canonicalUrl = idParts === null ? sourceUrl : `https://arxiv.org/abs/${idParts.baseId}`;
  const landingUrl = canonicalUrl;
  const submittedAt = dateValue(
    firstDefined(paper["submittedOnDailyAt"], entryRecord["publishedAt"]),
  );

  return {
    arxivId: idParts?.baseId ?? null,
    version: idParts?.version ?? null,
    title: requiredText(firstDefined(entryRecord["title"], paper["title"]), "title"),
    authors: authorsValue(paper["authors"]),
    abstract: textValue(firstDefined(paper["summary"], entryRecord["summary"])),
    publishedAt: dateValue(firstDefined(paper["publishedAt"], entryRecord["publishedAt"])),
    revisedAt: null,
    landingUrl,
    pdfUrl: idParts === null ? null : `https://arxiv.org/pdf/${idParts.baseId}`,
    sourceUrl,
    canonicalUrl,
    hfPaperId,
    hfLikes: numberValue(paper["upvotes"]) ?? numberValue(entryRecord["upvotes"]) ?? 0,
    hfRank: originalIndex + 1,
    hfSubmittedAt: submittedAt,
    hfSummary: textValue(paper["ai_summary"]),
    hfKeywords: arrayValue(paper["ai_keywords"]).map(textValue).filter(isDefined),
    projectPage: urlText(paper["projectPage"]),
    githubRepo: urlText(paper["githubRepo"]),
  };
}

function resolveArxivId(paper: UnknownRecord, sourceUrl: string): string | null {
  const candidates = [
    textValue(paper["id"]),
    urlText(paper["url"]),
    urlText(paper["paperUrl"]),
    urlText(paper["pdfUrl"]),
    sourceUrl,
  ];

  for (const candidate of candidates) {
    if (candidate === null) {
      continue;
    }

    const arxivId = extractArxivId(candidate);

    if (arxivId !== null) {
      return arxivId;
    }
  }

  return null;
}

function authorsValue(value: unknown): string[] {
  return arrayValue(value)
    .map((author) => {
      const record = recordValue(author);
      const user = recordValue(record["user"]);
      return textValue(record["name"]) ?? textValue(user["fullname"]) ?? textValue(user["name"]);
    })
    .filter(isDefined);
}

function requiredText(value: unknown, field: string): string {
  const text = textValue(value);

  if (text === null) {
    throw new HuggingFaceDailyPapersFetchError(
      `Hugging Face Daily Papers payload is missing ${field}.`,
      "PARSE_ERROR",
    );
  }

  return text;
}

function textValue(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") {
    const normalized = String(value).replace(/\s+/g, " ").trim();
    return normalized.length === 0 ? null : normalized;
  }

  return null;
}

function urlText(value: unknown): string | null {
  const text = textValue(value);

  if (text === null) {
    return null;
  }

  try {
    return new URL(text).toString();
  } catch {
    return null;
  }
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null;
  }

  return null;
}

function dateValue(value: unknown): Date | null {
  const text = textValue(value);

  if (text === null) {
    return null;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function absoluteUrl(path: string, baseUrl: string): string {
  return new URL(path, baseUrl).toString();
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null);
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function recordValue(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function splitArxivVersion(id: string): { baseId: string; version: string | null } {
  const normalized = id.trim().replace(/\.pdf$/i, "");
  const match = normalized.match(
    /^(?<base>(?:[a-z-]+(?:\.[a-z]+)?\/\d{7})|(?:\d{4}\.\d{4,5}))(?<version>v\d+)?$/i,
  );

  return {
    baseId: match?.groups?.["base"] ?? normalized,
    version: match?.groups?.["version"] ?? null,
  };
}

function isDefined<T>(value: T | null): value is T {
  return value !== null;
}
