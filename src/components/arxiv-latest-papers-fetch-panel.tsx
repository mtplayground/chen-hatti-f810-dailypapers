"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ARXIV_CUSTOM_FIELD_ID, listArxivFieldPresets } from "@/services/arxiv-field-presets";
import {
  buildArxivLatestPapersFetchPayload,
  splitArxivLatestPapersCustomKeywords,
} from "@/services/arxiv-latest-papers-fetch-payload";

const fieldPresets = listArxivFieldPresets();
const DEFAULT_FIELD = fieldPresets.find((preset) => preset.id !== ARXIV_CUSTOM_FIELD_ID)?.id ?? "";

type ArxivLatestPapersFetchResult = {
  fetched?: number;
  ingested?: number;
  skipped?: number;
  failed?: number;
  error?: string;
};

type FetchSuccessPayload = {
  field: string;
  customKeywords: string[];
};

export function ArxivLatestPapersFetchPanel({
  onFetchSuccess,
}: Readonly<{
  onFetchSuccess?: (payload: FetchSuccessPayload) => void;
}>) {
  const router = useRouter();
  const [field, setField] = useState(DEFAULT_FIELD);
  const [maxResults, setMaxResults] = useState("5");
  const [autoSummarize, setAutoSummarize] = useState(true);
  const [customKeywordsText, setCustomKeywordsText] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [result, setResult] = useState<ArxivLatestPapersFetchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedField = fieldPresets.find((preset) => preset.id === field) ?? null;
  const customKeywords = useMemo(
    () => splitArxivLatestPapersCustomKeywords(customKeywordsText),
    [customKeywordsText],
  );
  const parsedMaxResults = Number(maxResults);
  const maxResultsValid =
    Number.isInteger(parsedMaxResults) && parsedMaxResults >= 1 && parsedMaxResults <= 50;
  const needsCustomKeywords = field === ARXIV_CUSTOM_FIELD_ID;
  const canFetch =
    field !== "" &&
    maxResultsValid &&
    !isFetching &&
    (!needsCustomKeywords || customKeywords.length > 0);

  async function submitFetch(): Promise<void> {
    if (!canFetch) {
      return;
    }

    setIsFetching(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/arxiv/daily-fetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildArxivLatestPapersFetchPayload({
            field,
            customKeywordsText,
            maxResults: parsedMaxResults,
            autoSummarize,
          }),
        ),
      });
      const body = (await response.json()) as ArxivLatestPapersFetchResult;

      if (!response.ok) {
        throw new Error(body.error ?? "Unable to fetch latest arXiv papers.");
      }

      setResult(body);
      onFetchSuccess?.({ field, customKeywords });
      router.refresh();
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : "Unable to fetch latest arXiv papers.",
      );
    } finally {
      setIsFetching(false);
    }
  }

  return (
    <section
      aria-label="arXiv latest papers fetch panel"
      className="grid gap-4 border border-[var(--color-border)] bg-[var(--color-panel)] p-4 shadow-sm"
    >
      <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-start">
        <div>
          <p className="text-sm font-semibold text-[var(--color-muted)]">arXiv latest papers</p>
          <h2 className="text-xl font-semibold">Latest Top Papers by Field</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
            Pick a preset, choose how many recent papers to ingest, and refresh the dashboard after
            the fetch completes.
          </p>
        </div>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--color-border)] px-4 py-2 text-sm font-semibold transition hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canFetch}
          onClick={() => {
            void submitFetch();
          }}
          type="button"
        >
          <RefreshCw aria-hidden="true" className={isFetching ? "animate-spin" : ""} size={16} />
          {isFetching ? "Fetching…" : "Fetch latest papers"}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(12rem,1.3fr)_minmax(8rem,0.5fr)_minmax(10rem,0.7fr)]">
        <label className="grid gap-1 text-sm font-semibold">
          Field preset
          <select
            className="min-h-11 border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm font-normal outline-none focus:border-[var(--color-accent)]"
            onChange={(event) => {
              setField(event.target.value);
              setResult(null);
              setError(null);
            }}
            value={field}
          >
            {fieldPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm font-semibold">
          Max results
          <input
            className="min-h-11 border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm font-normal outline-none focus:border-[var(--color-accent)]"
            max={50}
            min={1}
            onChange={(event) => {
              setMaxResults(event.target.value);
              setResult(null);
              setError(null);
            }}
            type="number"
            value={maxResults}
          />
        </label>

        <label className="flex min-h-11 items-center gap-2 self-end border border-[var(--color-border)] px-3 py-2 text-sm font-semibold">
          <input
            checked={autoSummarize}
            className="size-4 accent-[var(--color-accent)]"
            onChange={(event) => setAutoSummarize(event.target.checked)}
            type="checkbox"
          />
          Auto summarize
        </label>
      </div>

      {selectedField !== null ? (
        <p className="text-sm leading-6 text-[var(--color-muted)]">{selectedField.description}</p>
      ) : null}

      {needsCustomKeywords ? (
        <label className="grid gap-1 text-sm font-semibold">
          Custom keywords
          <textarea
            className="min-h-24 border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm font-normal outline-none focus:border-[var(--color-accent)]"
            onChange={(event) => {
              setCustomKeywordsText(event.target.value);
              setResult(null);
              setError(null);
            }}
            placeholder="Comma- or newline-separated arXiv keywords"
            value={customKeywordsText}
          />
        </label>
      ) : null}

      {!maxResultsValid ? (
        <p className="text-sm font-medium text-red-600">
          Max results must be an integer from 1 to 50.
        </p>
      ) : null}
      {needsCustomKeywords && customKeywords.length === 0 ? (
        <p className="text-sm font-medium text-red-600">
          Custom fetches require at least one keyword.
        </p>
      ) : null}
      {error !== null ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      {result !== null ? <FetchResultSummary result={result} /> : null}
    </section>
  );
}

function FetchResultSummary({ result }: Readonly<{ result: ArxivLatestPapersFetchResult }>) {
  const counts = [
    ["Fetched", result.fetched ?? 0],
    ["Ingested", result.ingested ?? 0],
    ["Skipped", result.skipped ?? 0],
    ["Failed", result.failed ?? 0],
  ] as const;

  return (
    <div className="grid gap-2 rounded-sm border border-[var(--color-border)] p-3 sm:grid-cols-4">
      {counts.map(([label, value]) => (
        <div key={label}>
          <p className="text-lg font-semibold">{value}</p>
          <p className="text-xs font-medium text-[var(--color-muted)]">{label}</p>
        </div>
      ))}
    </div>
  );
}
