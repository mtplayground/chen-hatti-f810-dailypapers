"use client";

import { CheckCircle2, FileText, Link2, ListPlus, Loader2, Plus, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

type AddMode = "single" | "batch" | "markdown";

type ResultLine = {
  url: string;
  ok: boolean;
  label: string;
  error?: string;
};

type SubmitState =
  | {
      status: "idle";
      message: string | null;
      results: ResultLine[];
    }
  | {
      status: "submitting";
      message: string | null;
      results: ResultLine[];
    }
  | {
      status: "success" | "error";
      message: string;
      results: ResultLine[];
    };

const modeOptions: Array<{
  id: AddMode;
  label: string;
  icon: typeof Link2;
}> = [
  { id: "single", label: "Single URL", icon: Link2 },
  { id: "batch", label: "Batch URLs", icon: ListPlus },
  { id: "markdown", label: "Markdown", icon: FileText },
];

export function AddItemPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AddMode>("single");
  const [singleUrl, setSingleUrl] = useState("");
  const [batchUrls, setBatchUrls] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [markdownFile, setMarkdownFile] = useState<File | null>(null);
  const [important, setImportant] = useState(false);
  const [autoSummarize, setAutoSummarize] = useState(true);
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
    message: null,
    results: [],
  });

  const busy = submitState.status === "submitting";
  const canSubmit = useMemo(() => {
    if (busy) {
      return false;
    }

    if (mode === "single") {
      return singleUrl.trim().length > 0;
    }

    if (mode === "batch") {
      return batchUrls.trim().length > 0;
    }

    return markdown.trim().length > 0 || markdownFile !== null;
  }, [batchUrls, busy, markdown, markdownFile, mode, singleUrl]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState({ status: "submitting", message: "Importing items...", results: [] });

    try {
      const response = await submitIngestion({
        autoSummarize,
        batchUrls,
        important,
        markdown,
        markdownFile,
        mode,
        singleUrl,
      });

      if (!response.ok) {
        const message = await errorMessageFromResponse(response);
        setSubmitState({ status: "error", message, results: [] });
        return;
      }

      const payload = (await response.json()) as unknown;
      const results = resultLinesFromPayload(mode, payload);
      const failed = results.filter((result) => !result.ok).length;
      const succeeded = results.length - failed;
      const message =
        failed === 0
          ? `${succeeded} item${succeeded === 1 ? "" : "s"} imported.`
          : `${succeeded} imported, ${failed} failed.`;

      setSubmitState({
        status: failed === results.length ? "error" : "success",
        message,
        results,
      });

      if (succeeded > 0) {
        router.refresh();
      }
    } catch (error) {
      setSubmitState({
        status: "error",
        message: error instanceof Error ? error.message : "Unable to import items.",
        results: [],
      });
    }
  }

  function switchMode(nextMode: AddMode) {
    setMode(nextMode);
    setSubmitState({ status: "idle", message: null, results: [] });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="inline-flex min-h-10 items-center gap-2 bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-ink)] transition hover:opacity-90"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Plus aria-hidden="true" size={17} />
        Add Item
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
          <div className="grid max-h-[90vh] w-full max-w-3xl gap-5 overflow-y-auto border border-[var(--color-border)] bg-[var(--color-panel)] p-5 shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="grid gap-1">
                <p className="text-xs font-semibold tracking-[0.08em] text-[var(--color-muted)] uppercase">
                  Import
                </p>
                <h2 className="text-xl font-semibold">Add Daily Item</h2>
              </div>
              <button
                aria-label="Close add item dialog"
                className="inline-flex size-10 items-center justify-center border border-[var(--color-border)] transition hover:border-[var(--color-accent)]"
                onClick={() => setOpen(false)}
                type="button"
              >
                <XCircle aria-hidden="true" size={18} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Import mode">
              {modeOptions.map((option) => {
                const Icon = option.icon;
                const active = mode === option.id;

                return (
                  <button
                    aria-selected={active}
                    className={`inline-flex min-h-10 items-center gap-2 border px-3 py-2 text-sm font-semibold transition ${
                      active
                        ? "border-[var(--color-accent)] bg-[var(--color-surface)]"
                        : "border-[var(--color-border)] hover:border-[var(--color-accent)]"
                    }`}
                    key={option.id}
                    onClick={() => switchMode(option.id)}
                    role="tab"
                    type="button"
                  >
                    <Icon aria-hidden="true" size={16} />
                    {option.label}
                  </button>
                );
              })}
            </div>

            <form className="grid gap-4" onSubmit={handleSubmit}>
              {mode === "single" ? (
                <Field label="URL" htmlFor="single-url">
                  <input
                    className="min-h-11 w-full border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                    id="single-url"
                    onChange={(event) => setSingleUrl(event.target.value)}
                    placeholder="https://arxiv.org/abs/..."
                    type="url"
                    value={singleUrl}
                  />
                </Field>
              ) : null}

              {mode === "batch" ? (
                <Field label="URLs" htmlFor="batch-urls">
                  <textarea
                    className="min-h-44 w-full resize-y border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--color-accent)]"
                    id="batch-urls"
                    onChange={(event) => setBatchUrls(event.target.value)}
                    placeholder="Paste one URL per line"
                    value={batchUrls}
                  />
                </Field>
              ) : null}

              {mode === "markdown" ? (
                <div className="grid gap-4">
                  <Field label="Markdown" htmlFor="markdown-content">
                    <textarea
                      className="min-h-48 w-full resize-y border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--color-accent)]"
                      id="markdown-content"
                      onChange={(event) => setMarkdown(event.target.value)}
                      placeholder="Paste Markdown with paper or repository links"
                      value={markdown}
                    />
                  </Field>
                  <Field label="Markdown file" htmlFor="markdown-file">
                    <input
                      accept=".md,.markdown,text/markdown,text/plain"
                      className="w-full border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm"
                      id="markdown-file"
                      onChange={(event) => setMarkdownFile(event.target.files?.[0] ?? null)}
                      type="file"
                    />
                  </Field>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-4 border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    checked={important}
                    onChange={(event) => setImportant(event.target.checked)}
                    type="checkbox"
                  />
                  Important
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    checked={autoSummarize}
                    onChange={(event) => setAutoSummarize(event.target.checked)}
                    type="checkbox"
                  />
                  Auto summarize
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  className="inline-flex min-h-10 items-center gap-2 bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-ink)] transition disabled:cursor-not-allowed disabled:opacity-55"
                  disabled={!canSubmit}
                  type="submit"
                >
                  {busy ? <Loader2 aria-hidden="true" className="animate-spin" size={16} /> : null}
                  Import
                </button>
                {submitState.message !== null ? (
                  <p
                    className={`text-sm font-medium ${
                      submitState.status === "error"
                        ? "text-red-700 dark:text-red-300"
                        : "text-[var(--color-muted)]"
                    }`}
                    role="status"
                  >
                    {submitState.message}
                  </p>
                ) : null}
              </div>
            </form>

            {submitState.results.length > 0 ? <ResultList results={submitState.results} /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  children,
  htmlFor,
  label,
}: Readonly<{
  children: React.ReactNode;
  htmlFor: string;
  label: string;
}>) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-semibold" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ResultList({ results }: { results: ResultLine[] }) {
  return (
    <div className="grid gap-2 border-t border-[var(--color-border)] pt-4">
      <h3 className="text-sm font-semibold">Import Results</h3>
      <ul className="grid max-h-64 gap-2 overflow-y-auto text-sm">
        {results.map((result) => (
          <li
            className="grid gap-1 border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
            key={`${result.url}:${result.label}`}
          >
            <span className="flex items-center gap-2 font-semibold">
              {result.ok ? (
                <CheckCircle2 aria-hidden="true" className="text-[var(--color-accent)]" size={16} />
              ) : (
                <XCircle aria-hidden="true" className="text-red-700 dark:text-red-300" size={16} />
              )}
              {result.label}
            </span>
            <span className="break-all text-[var(--color-muted)]">{result.url}</span>
            {result.error !== undefined ? (
              <span className="text-red-700 dark:text-red-300">{result.error}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

async function submitIngestion(input: {
  autoSummarize: boolean;
  batchUrls: string;
  important: boolean;
  markdown: string;
  markdownFile: File | null;
  mode: AddMode;
  singleUrl: string;
}) {
  if (input.mode === "single") {
    return fetch("/api/ingest/url", {
      body: JSON.stringify({
        autoSummarize: input.autoSummarize,
        important: input.important,
        url: input.singleUrl.trim(),
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
  }

  if (input.mode === "batch") {
    return fetch("/api/ingest/batch", {
      body: JSON.stringify({
        autoSummarize: input.autoSummarize,
        important: input.important,
        urls: input.batchUrls,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
  }

  if (input.markdownFile !== null) {
    const formData = new FormData();
    formData.set("file", input.markdownFile);
    formData.set("markdown", input.markdown);
    formData.set("important", String(input.important));
    formData.set("autoSummarize", String(input.autoSummarize));

    return fetch("/api/ingest/markdown", {
      body: formData,
      method: "POST",
    });
  }

  return fetch("/api/ingest/markdown", {
    body: JSON.stringify({
      autoSummarize: input.autoSummarize,
      important: input.important,
      markdown: input.markdown,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

function resultLinesFromPayload(mode: AddMode, payload: unknown): ResultLine[] {
  if (mode === "single" && isRecord(payload)) {
    const url = stringValue(payload["url"]) ?? "URL";
    const source = stringValue(payload["source"]) ?? "Item";

    return [{ url, ok: true, label: `${source} imported` }];
  }

  const results = isRecord(payload) && Array.isArray(payload["results"]) ? payload["results"] : [];

  return results.map((result, index) => {
    if (!isRecord(result)) {
      return {
        url: `Result ${index + 1}`,
        ok: false,
        label: "Invalid result",
        error: "The server returned an unexpected result.",
      };
    }

    const url = stringValue(result["url"]) ?? `Result ${index + 1}`;
    const ok = result["ok"] === true;

    if (!ok) {
      return {
        url,
        ok,
        label: "Import failed",
        error: stringValue(result["error"]) ?? "Unknown import error.",
      };
    }

    return {
      url,
      ok,
      label: `${stringValue(result["source"]) ?? "Item"} imported`,
    };
  });
}

async function errorMessageFromResponse(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as unknown;

    if (isRecord(payload)) {
      return stringValue(payload["error"]) ?? `Import failed with status ${response.status}.`;
    }
  } catch {
    return `Import failed with status ${response.status}.`;
  }

  return `Import failed with status ${response.status}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
