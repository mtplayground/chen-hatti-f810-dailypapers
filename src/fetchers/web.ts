import * as cheerio from "cheerio";

import { genericMetadataFetchInputSchema, type GenericMetadataFetchInput } from "@/validators/web";

const MAX_TEXT_BYTES = 2_000_000;
const PDF_INFO_SCAN_BYTES = 1_000_000;

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type GenericMetadataKind = "HTML" | "PDF" | "UNKNOWN";

export type GenericWebMetadata = {
  kind: GenericMetadataKind;
  sourceUrl: string;
  finalUrl: string;
  canonicalUrl: string;
  contentType: string | null;
  title: string | null;
  abstract: string | null;
  description: string | null;
  authors: string[];
  publishedAt: Date | null;
  siteName: string | null;
  pdfUrl: string | null;
};

export class GenericMetadataFetchError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID_URL" | "TOO_LARGE" | "UPSTREAM_ERROR" | "PARSE_ERROR",
  ) {
    super(message);
    this.name = "GenericMetadataFetchError";
  }
}

export async function fetchGenericMetadata(
  input: GenericMetadataFetchInput | string,
  options: { fetcher?: FetchLike; signal?: AbortSignal } = {},
): Promise<GenericWebMetadata> {
  const { url } =
    typeof input === "string"
      ? genericMetadataFetchInputSchema.parse({ url: input })
      : genericMetadataFetchInputSchema.parse(input);
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(url, requestInit(options.signal));

  if (!response.ok) {
    throw new GenericMetadataFetchError(
      `Metadata request failed with ${response.status} ${response.statusText}.`,
      "UPSTREAM_ERROR",
    );
  }

  const finalUrl = response.url.length > 0 ? response.url : url;
  const contentType = normalizeContentType(response.headers.get("content-type"));
  const kind = detectKind(url, finalUrl, contentType);

  if (kind === "PDF") {
    return parsePdfMetadata(response, url, finalUrl, contentType);
  }

  if (kind === "HTML") {
    return parseHtmlMetadata(response, url, finalUrl, contentType);
  }

  return {
    kind,
    sourceUrl: url,
    finalUrl,
    canonicalUrl: finalUrl,
    contentType,
    title: titleFromUrl(finalUrl),
    abstract: null,
    description: null,
    authors: [],
    publishedAt: null,
    siteName: null,
    pdfUrl: null,
  };
}

async function parseHtmlMetadata(
  response: Response,
  sourceUrl: string,
  finalUrl: string,
  contentType: string | null,
): Promise<GenericWebMetadata> {
  const html = await readLimitedText(response);
  const $ = cheerio.load(html);
  const canonicalUrl = absoluteUrl(
    firstNonEmpty([
      $("link[rel='canonical']").attr("href"),
      meta($, "og:url"),
      meta($, "twitter:url"),
    ]),
    finalUrl,
  );
  const title = firstNonEmpty([
    meta($, "citation_title"),
    meta($, "dc.title"),
    meta($, "dcterms.title"),
    meta($, "og:title"),
    meta($, "twitter:title"),
    $("title").first().text(),
    $("h1").first().text(),
  ]);
  const abstract = firstNonEmpty([
    meta($, "citation_abstract"),
    meta($, "dc.description"),
    meta($, "dcterms.abstract"),
    meta($, "description"),
    meta($, "og:description"),
    meta($, "twitter:description"),
  ]);
  const pdfUrl = absoluteUrl(
    firstNonEmpty([
      meta($, "citation_pdf_url"),
      $("a[href$='.pdf']").first().attr("href"),
      $("a[type='application/pdf']").first().attr("href"),
    ]),
    finalUrl,
  );

  return {
    kind: "HTML",
    sourceUrl,
    finalUrl,
    canonicalUrl: canonicalUrl ?? finalUrl,
    contentType,
    title,
    abstract,
    description: abstract,
    authors: authorsFromHtml($),
    publishedAt: dateValue(
      firstNonEmpty([
        meta($, "citation_publication_date"),
        meta($, "article:published_time"),
        meta($, "dc.date"),
        meta($, "dcterms.created"),
      ]),
    ),
    siteName: firstNonEmpty([meta($, "og:site_name"), meta($, "application-name")]),
    pdfUrl,
  };
}

async function parsePdfMetadata(
  response: Response,
  sourceUrl: string,
  finalUrl: string,
  contentType: string | null,
): Promise<GenericWebMetadata> {
  const buffer = Buffer.from(await response.arrayBuffer());
  const pdfInfo = extractPdfInfo(buffer);
  const title =
    pdfInfo.title ??
    titleFromContentDisposition(response.headers.get("content-disposition")) ??
    titleFromUrl(finalUrl);

  return {
    kind: "PDF",
    sourceUrl,
    finalUrl,
    canonicalUrl: finalUrl,
    contentType,
    title,
    abstract: pdfInfo.subject,
    description: pdfInfo.subject,
    authors: pdfInfo.author === null ? [] : [pdfInfo.author],
    publishedAt: null,
    siteName: null,
    pdfUrl: finalUrl,
  };
}

function requestInit(signal: AbortSignal | undefined): RequestInit {
  const init: RequestInit = {
    headers: {
      Accept:
        "text/html, application/xhtml+xml, application/pdf;q=0.9, text/plain;q=0.7, */*;q=0.5",
      "User-Agent": "chen-hatti-f810-dailypapers/0.1 generic-metadata-fetcher",
    },
    redirect: "follow",
  };

  if (signal !== undefined) {
    init.signal = signal;
  }

  return init;
}

async function readLimitedText(response: Response): Promise<string> {
  const contentLength = numberHeader(response.headers.get("content-length"));

  if (contentLength !== null && contentLength > MAX_TEXT_BYTES) {
    throw new GenericMetadataFetchError(
      `HTML response exceeds ${MAX_TEXT_BYTES} bytes.`,
      "TOO_LARGE",
    );
  }

  const text = await response.text();

  if (Buffer.byteLength(text, "utf8") > MAX_TEXT_BYTES) {
    throw new GenericMetadataFetchError(
      `HTML response exceeds ${MAX_TEXT_BYTES} bytes.`,
      "TOO_LARGE",
    );
  }

  return text;
}

function detectKind(
  sourceUrl: string,
  finalUrl: string,
  contentType: string | null,
): GenericMetadataKind {
  if (contentType?.includes("application/pdf") === true || looksLikePdfUrl(finalUrl)) {
    return "PDF";
  }

  if (
    contentType === null ||
    contentType.includes("text/html") ||
    contentType.includes("application/xhtml+xml")
  ) {
    return looksLikePdfUrl(sourceUrl) ? "PDF" : "HTML";
  }

  return "UNKNOWN";
}

function meta($: cheerio.CheerioAPI, name: string): string | null {
  return firstNonEmpty([
    $(`meta[name='${name}']`).attr("content"),
    $(`meta[property='${name}']`).attr("content"),
  ]);
}

function authorsFromHtml($: cheerio.CheerioAPI): string[] {
  const values = [
    ...metaList($, "citation_author"),
    ...metaList($, "article:author"),
    ...splitAuthorList(meta($, "author")),
    ...splitAuthorList(meta($, "dc.creator")),
  ];
  const seen = new Set<string>();
  const authors: string[] = [];

  for (const value of values) {
    const author = normalizeWhitespace(value);
    const key = author.toLowerCase();

    if (author.length > 0 && !seen.has(key)) {
      seen.add(key);
      authors.push(author);
    }
  }

  return authors;
}

function metaList($: cheerio.CheerioAPI, name: string): string[] {
  const values: string[] = [];

  $(`meta[name='${name}'], meta[property='${name}']`).each((_, element) => {
    const content = $(element).attr("content");

    if (content !== undefined) {
      values.push(content);
    }
  });

  return values;
}

function splitAuthorList(value: string | null): string[] {
  if (value === null) {
    return [];
  }

  return value.split(/\s*(?:;|\band\b|,)\s*/i).filter((part) => part.trim().length > 0);
}

function extractPdfInfo(buffer: Buffer): {
  title: string | null;
  subject: string | null;
  author: string | null;
} {
  const header = buffer.subarray(0, PDF_INFO_SCAN_BYTES).toString("latin1");

  return {
    title: pdfInfoValue(header, "Title"),
    subject: pdfInfoValue(header, "Subject"),
    author: pdfInfoValue(header, "Author"),
  };
}

function pdfInfoValue(source: string, key: "Title" | "Subject" | "Author"): string | null {
  const hexPattern = new RegExp(`/${key}\\s*<(?<hex>[0-9a-fA-F]+)>`);
  const textPattern = new RegExp(`/${key}\\s*\\((?<text>(?:\\\\.|[^\\\\)])*)\\)`);
  const hex = source.match(hexPattern)?.groups?.["hex"];

  if (hex !== undefined) {
    return normalizeWhitespace(decodePdfHexString(hex));
  }

  const text = source.match(textPattern)?.groups?.["text"];
  return text === undefined ? null : normalizeWhitespace(unescapePdfString(text));
}

function unescapePdfString(value: string): string {
  return value
    .replace(/\\([nrtbf()\\])/g, (_, escaped: string) => {
      switch (escaped) {
        case "n":
          return "\n";
        case "r":
          return "\r";
        case "t":
          return "\t";
        case "b":
          return "\b";
        case "f":
          return "\f";
        default:
          return escaped;
      }
    })
    .replace(/\\([0-7]{1,3})/g, (_, octal: string) =>
      String.fromCharCode(Number.parseInt(octal, 8)),
    );
}

function decodePdfHexString(value: string): string {
  const buffer = Buffer.from(value, "hex");

  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.alloc(buffer.length - 2);

    for (let index = 2; index + 1 < buffer.length; index += 2) {
      swapped[index - 2] = buffer[index + 1] ?? 0;
      swapped[index - 1] = buffer[index] ?? 0;
    }

    return swapped.toString("utf16le");
  }

  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString("utf16le");
  }

  return buffer.toString("utf8");
}

function titleFromContentDisposition(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const filenameStar = value.match(/filename\*=UTF-8''(?<filename>[^;]+)/i)?.groups?.["filename"];
  const filename = filenameStar ?? value.match(/filename="?([^";]+)"?/i)?.[1] ?? null;

  if (filename === null) {
    return null;
  }

  return titleFromPath(decodeURIComponent(filename));
}

function titleFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const path = url.pathname.split("/").filter(Boolean).at(-1);
    return path === undefined ? url.hostname : titleFromPath(decodeURIComponent(path));
  } catch {
    return null;
  }
}

function titleFromPath(value: string): string | null {
  const title = normalizeWhitespace(
    value
      .replace(/\.(?:pdf|html?|xhtml)$/i, "")
      .replace(/[-_]+/g, " ")
      .trim(),
  );

  return title.length === 0 ? null : title;
}

function absoluteUrl(value: string | null, baseUrl: string): string | null {
  if (value === null) {
    return null;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function dateValue(value: string | null): Date | null {
  if (value === null) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function firstNonEmpty(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      const normalized = normalizeWhitespace(value);

      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  return null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeContentType(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const [contentType] = value.toLowerCase().split(";");
  return contentType?.trim() || null;
}

function numberHeader(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function looksLikePdfUrl(value: string): boolean {
  try {
    return new URL(value).pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}
