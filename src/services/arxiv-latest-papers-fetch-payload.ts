import { ARXIV_CUSTOM_FIELD_ID } from "@/services/arxiv-field-presets";

export type ArxivLatestPapersFetchPayload = {
  field: string;
  maxResults: number;
  autoSummarize: boolean;
  keywords?: string[];
};

export type BuildArxivLatestPapersFetchPayloadInput = {
  field: string;
  maxResults: number;
  autoSummarize: boolean;
  customKeywordsText?: string;
};

export function buildArxivLatestPapersFetchPayload(
  input: BuildArxivLatestPapersFetchPayloadInput,
): ArxivLatestPapersFetchPayload {
  return {
    field: input.field,
    ...(input.field === ARXIV_CUSTOM_FIELD_ID
      ? { keywords: splitArxivLatestPapersCustomKeywords(input.customKeywordsText ?? "") }
      : {}),
    maxResults: input.maxResults,
    autoSummarize: input.autoSummarize,
  };
}

export function splitArxivLatestPapersCustomKeywords(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,]+/)
        .map((keyword) => keyword.trim())
        .filter((keyword) => keyword.length > 0),
    ),
  ];
}
