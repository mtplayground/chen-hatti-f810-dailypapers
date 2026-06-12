import { ingestBatchUrls, type BatchIngestUrlResult } from "@/services/ingestion";
import { markdownImportSchema } from "@/validators/markdown";

export type MarkdownImportResult = {
  urls: string[];
  results: BatchIngestUrlResult[];
};

export class MarkdownImportError extends Error {
  constructor(
    message: string,
    readonly code: "NO_URLS_FOUND",
  ) {
    super(message);
    this.name = "MarkdownImportError";
  }
}

export async function importMarkdownItems(input: unknown): Promise<MarkdownImportResult> {
  const data = markdownImportSchema.parse(input);
  const urls = extractMarkdownUrls(data.markdown);

  if (urls.length === 0) {
    throw new MarkdownImportError(
      "No ingestible URLs were found in the Markdown content.",
      "NO_URLS_FOUND",
    );
  }

  const { results } = await ingestBatchUrls({
    urls,
    important: data.important,
    autoSummarize: data.autoSummarize,
  });
  return { urls, results };
}

export function extractMarkdownUrls(markdown: string): string[] {
  const withoutCode = stripCodeBlocks(markdown);
  const urls = [
    ...extractMarkdownLinkTargets(withoutCode),
    ...extractAutolinks(withoutCode),
    ...extractBareUrls(withoutCode),
  ];
  const uniqueUrls = new Set<string>();

  for (const url of urls) {
    const normalized = normalizeUrlCandidate(url);

    if (normalized !== null) {
      uniqueUrls.add(normalized);
    }
  }

  return [...uniqueUrls];
}

function stripCodeBlocks(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, "\n")
    .replace(/~~~[\s\S]*?~~~/g, "\n")
    .replace(/^(?: {4}|\t).+$/gm, "");
}

function extractMarkdownLinkTargets(markdown: string): string[] {
  const urls: string[] = [];
  const linkPattern = /!?\[[^\]]*]\(\s*(?<target><[^>]+>|[^\s)]+)(?:\s+["'][^"']*["'])?\s*\)/g;

  for (const match of markdown.matchAll(linkPattern)) {
    const target = match.groups?.["target"];

    if (target !== undefined) {
      urls.push(target);
    }
  }

  return urls;
}

function extractAutolinks(markdown: string): string[] {
  const urls: string[] = [];
  const autolinkPattern = /<(?<url>https?:\/\/[^>\s]+)>/g;

  for (const match of markdown.matchAll(autolinkPattern)) {
    const url = match.groups?.["url"];

    if (url !== undefined) {
      urls.push(url);
    }
  }

  return urls;
}

function extractBareUrls(markdown: string): string[] {
  const urls: string[] = [];
  const bareUrlPattern = /(?<url>https?:\/\/[^\s<>"'`]+)\b/g;

  for (const match of markdown.matchAll(bareUrlPattern)) {
    const url = match.groups?.["url"];

    if (url !== undefined) {
      urls.push(url);
    }
  }

  return urls;
}

function normalizeUrlCandidate(value: string): string | null {
  const withoutAngles = value.trim().replace(/^<|>$/g, "");
  const withoutTrailingPunctuation = withoutAngles.replace(/[)\].,;:!?]+$/g, "");

  try {
    const url = new URL(withoutTrailingPunctuation);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}
