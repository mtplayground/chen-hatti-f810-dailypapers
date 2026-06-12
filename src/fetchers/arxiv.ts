import { XMLParser } from "fast-xml-parser";

import { arxivFetchInputSchema, type ArxivFetchInput } from "@/validators/arxiv";

const ARXIV_API_URL = "https://export.arxiv.org/api/query";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

type ArxivIdParts = {
  baseId: string;
  version: string | null;
};

type ArxivApiLink = {
  href?: unknown;
  rel?: unknown;
  title?: unknown;
  type?: unknown;
};

type ArxivApiAuthor = {
  name?: unknown;
};

type ArxivApiEntry = {
  id?: unknown;
  title?: unknown;
  summary?: unknown;
  published?: unknown;
  updated?: unknown;
  author?: ArxivApiAuthor | ArxivApiAuthor[];
  link?: ArxivApiLink | ArxivApiLink[];
  "arxiv:comment"?: unknown;
  "arxiv:doi"?: unknown;
  "arxiv:journal_ref"?: unknown;
  "arxiv:primary_category"?: {
    term?: unknown;
  };
  category?: { term?: unknown } | Array<{ term?: unknown }>;
};

type ArxivApiFeed = {
  feed?: {
    entry?: ArxivApiEntry | ArxivApiEntry[];
  };
};

export type ArxivPaperMetadata = {
  arxivId: string;
  version: string | null;
  title: string;
  authors: string[];
  abstract: string;
  venue: string | null;
  publishedAt: Date | null;
  revisedAt: Date | null;
  landingUrl: string;
  pdfUrl: string;
  doi: string | null;
  primaryCategory: string | null;
  categories: string[];
  sourceUrl: string;
  canonicalUrl: string;
};

export type ArxivKeywordSearchInput = {
  keywords: string[];
  maxResults: number;
  submittedAfter?: Date;
};

export class ArxivFetchError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID_ARXIV_URL" | "NOT_FOUND" | "UPSTREAM_ERROR" | "PARSE_ERROR",
  ) {
    super(message);
    this.name = "ArxivFetchError";
  }
}

export async function searchArxivPapersByKeywords(
  input: ArxivKeywordSearchInput,
  options: { fetcher?: FetchLike; signal?: AbortSignal } = {},
): Promise<ArxivPaperMetadata[]> {
  const apiUrl = new URL(ARXIV_API_URL);
  apiUrl.searchParams.set("search_query", arxivKeywordQuery(input.keywords, input.submittedAfter));
  apiUrl.searchParams.set("start", "0");
  apiUrl.searchParams.set("max_results", String(input.maxResults));
  apiUrl.searchParams.set("sortBy", "submittedDate");
  apiUrl.searchParams.set("sortOrder", "descending");

  const fetcher = options.fetcher ?? fetch;
  const requestInit: RequestInit = {
    headers: {
      Accept: "application/atom+xml, application/xml;q=0.9, text/xml;q=0.8",
      "User-Agent": "chen-hatti-f810-dailypapers/0.1 arxiv-keyword-fetcher",
    },
  };

  if (options.signal !== undefined) {
    requestInit.signal = options.signal;
  }

  const response = await fetcher(apiUrl, requestInit);

  if (!response.ok) {
    throw new ArxivFetchError(
      `arXiv keyword search failed with ${response.status} ${response.statusText}.`,
      "UPSTREAM_ERROR",
    );
  }

  const feed = parseFeed(await response.text());
  const entries = feedEntries(feed);
  const papers = entries.map(entryToSearchMetadata);
  const uniquePapers = new Map(papers.map((paper) => [paper.arxivId, paper]));

  return [...uniquePapers.values()];
}

const parser = new XMLParser({
  attributeNamePrefix: "",
  ignoreAttributes: false,
  parseTagValue: false,
  textNodeName: "#text",
  trimValues: true,
});

export function extractArxivId(input: string): string | null {
  const value = input.trim();

  if (value.length === 0) {
    return null;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    if (hostname === "arxiv.org" || hostname.endsWith(".arxiv.org")) {
      const pathParts = url.pathname.split("/").filter(Boolean);
      const [kind, ...rest] = pathParts;

      if ((kind === "abs" || kind === "pdf" || kind === "e-print") && rest.length > 0) {
        return stripPdfExtension(rest.join("/"));
      }
    }
  } catch {
    // Treat non-URL input as a direct arXiv identifier below.
  }

  const directId = value.replace(/^arxiv:/i, "");
  return isArxivId(directId) ? stripPdfExtension(directId) : null;
}

export async function fetchArxivPaper(
  input: ArxivFetchInput | string,
  options: { fetcher?: FetchLike; signal?: AbortSignal } = {},
): Promise<ArxivPaperMetadata> {
  const { url } =
    typeof input === "string"
      ? arxivFetchInputSchema.parse({ url: input })
      : arxivFetchInputSchema.parse(input);
  const id = extractArxivId(url);

  if (id === null) {
    throw new ArxivFetchError(
      `Could not find an arXiv identifier in "${url}".`,
      "INVALID_ARXIV_URL",
    );
  }

  const idParts = splitArxivVersion(id);
  const queryId = idParts.version === null ? idParts.baseId : `${idParts.baseId}${idParts.version}`;
  const apiUrl = new URL(ARXIV_API_URL);
  apiUrl.searchParams.set("id_list", queryId);

  const fetcher = options.fetcher ?? fetch;
  const requestInit: RequestInit = {
    headers: {
      Accept: "application/atom+xml, application/xml;q=0.9, text/xml;q=0.8",
      "User-Agent": "chen-hatti-f810-dailypapers/0.1 arxiv-fetcher",
    },
  };

  if (options.signal !== undefined) {
    requestInit.signal = options.signal;
  }

  const response = await fetcher(apiUrl, requestInit);

  if (!response.ok) {
    throw new ArxivFetchError(
      `arXiv API request failed with ${response.status} ${response.statusText}.`,
      "UPSTREAM_ERROR",
    );
  }

  const xml = await response.text();
  const feed = parseFeed(xml);
  const entry = firstEntry(feed);

  if (entry === null) {
    throw new ArxivFetchError(`No arXiv record found for "${queryId}".`, "NOT_FOUND");
  }

  return entryToMetadata(entry, url, idParts);
}

function parseFeed(xml: string): ArxivApiFeed {
  try {
    return parser.parse(xml) as ArxivApiFeed;
  } catch (error) {
    throw new ArxivFetchError(
      `Could not parse arXiv API response: ${error instanceof Error ? error.message : "unknown error"}.`,
      "PARSE_ERROR",
    );
  }
}

function firstEntry(feed: ArxivApiFeed): ArxivApiEntry | null {
  return feedEntries(feed)[0] ?? null;
}

function feedEntries(feed: ArxivApiFeed): ArxivApiEntry[] {
  const entry = feed.feed?.entry;

  if (Array.isArray(entry)) {
    return entry;
  }

  return entry === undefined ? [] : [entry];
}

function entryToSearchMetadata(entry: ArxivApiEntry): ArxivPaperMetadata {
  const entryId = requiredText(entry.id, "id");
  const arxivId = extractArxivId(entryId);

  if (arxivId === null) {
    throw new ArxivFetchError(
      `arXiv API response has an invalid entry id "${entryId}".`,
      "PARSE_ERROR",
    );
  }

  return entryToMetadata(entry, entryId, splitArxivVersion(arxivId));
}

function entryToMetadata(
  entry: ArxivApiEntry,
  sourceUrl: string,
  requestedId: ArxivIdParts,
): ArxivPaperMetadata {
  const entryId = textValue(entry.id);
  const entryIdParts =
    entryId === null ? requestedId : splitArxivVersion(extractArxivId(entryId) ?? entryId);
  const canonicalId = entryIdParts.baseId;
  const title = requiredText(entry.title, "title");
  const abstract = requiredText(entry.summary, "abstract");
  const links = arrayify(entry.link);
  const journalRef = textValue(entry["arxiv:journal_ref"]);
  const comment = textValue(entry["arxiv:comment"]);
  const landingUrl =
    findLink(links, (link) => textValue(link.rel) === "alternate") ??
    `https://arxiv.org/abs/${canonicalId}`;
  const pdfUrl =
    findLink(
      links,
      (link) =>
        textValue(link.title)?.toLowerCase() === "pdf" ||
        textValue(link.type) === "application/pdf",
    ) ?? `https://arxiv.org/pdf/${canonicalId}`;

  return {
    arxivId: canonicalId,
    version: entryIdParts.version,
    title,
    authors: extractAuthors(entry.author),
    abstract,
    venue: journalRef ?? comment,
    publishedAt: dateValue(entry.published),
    revisedAt: dateValue(entry.updated),
    landingUrl,
    pdfUrl,
    doi: textValue(entry["arxiv:doi"]),
    primaryCategory: textValue(entry["arxiv:primary_category"]?.term),
    categories: arrayify(entry.category)
      .map((category) => textValue(category.term))
      .filter(isDefined),
    sourceUrl,
    canonicalUrl: `https://arxiv.org/abs/${canonicalId}`,
  };
}

function requiredText(value: unknown, field: string): string {
  const normalized = textValue(value);

  if (normalized === null) {
    throw new ArxivFetchError(`arXiv API response is missing ${field}.`, "PARSE_ERROR");
  }

  return normalized;
}

function extractAuthors(author: ArxivApiEntry["author"]): string[] {
  return arrayify(author)
    .map((entryAuthor) => textValue(entryAuthor.name))
    .filter(isDefined);
}

function findLink(
  links: ArxivApiLink[],
  predicate: (link: ArxivApiLink) => boolean,
): string | null {
  for (const link of links) {
    if (predicate(link)) {
      const href = textValue(link.href);

      if (href !== null) {
        return href;
      }
    }
  }

  return null;
}

function textValue(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") {
    return normalizeWhitespace(String(value));
  }

  if (isRecord(value)) {
    const text = value["#text"];

    if (typeof text === "string" || typeof text === "number") {
      return normalizeWhitespace(String(text));
    }
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

function splitArxivVersion(id: string): ArxivIdParts {
  const normalized = stripPdfExtension(id);
  const match = normalized.match(
    /^(?<base>(?:[a-z-]+(?:\.[a-z]+)?\/\d{7})|(?:\d{4}\.\d{4,5}))(?<version>v\d+)?$/i,
  );

  const baseId = match?.groups?.["base"];
  const version = match?.groups?.["version"];

  if (baseId === undefined) {
    throw new ArxivFetchError(`Invalid arXiv identifier "${id}".`, "INVALID_ARXIV_URL");
  }

  return {
    baseId,
    version: version ?? null,
  };
}

function isArxivId(value: string): boolean {
  try {
    splitArxivVersion(value);
    return true;
  } catch {
    return false;
  }
}

function stripPdfExtension(value: string): string {
  return value.trim().replace(/\.pdf$/i, "");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function arxivKeywordQuery(keywords: string[], submittedAfter: Date | undefined): string {
  const keywordQuery = keywords
    .map((keyword) => `all:${quoteArxivSearchTerm(keyword)}`)
    .join(" OR ");

  if (submittedAfter === undefined) {
    return keywordQuery;
  }

  return `(${keywordQuery}) AND submittedDate:[${formatArxivDate(submittedAfter)} TO 999912312359]`;
}

function quoteArxivSearchTerm(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function formatArxivDate(date: Date): string {
  const yyyy = date.getUTCFullYear().toString().padStart(4, "0");
  const mm = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = date.getUTCDate().toString().padStart(2, "0");
  const hh = date.getUTCHours().toString().padStart(2, "0");
  const min = date.getUTCMinutes().toString().padStart(2, "0");

  return `${yyyy}${mm}${dd}${hh}${min}`;
}

function arrayify<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function isDefined<T>(value: T | null): value is T {
  return value !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
