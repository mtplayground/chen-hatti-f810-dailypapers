"use client";

import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";

import { ARXIV_CUSTOM_FIELD_ID, listArxivFieldPresets } from "@/services/arxiv-field-presets";

export type DashboardTypeFilter = "ALL" | "PAPER" | "REPOSITORY";
export type DashboardSortMode = "date" | "relevance" | "stars" | "updated";

export type DashboardControlState = {
  query: string;
  type: DashboardTypeFilter;
  date: string;
  topic: string;
  field: string;
  minRelevance: string;
  sort: DashboardSortMode;
};

export const defaultDashboardControls: DashboardControlState = {
  query: "",
  type: "ALL",
  date: "",
  topic: "",
  field: "",
  minRelevance: "",
  sort: "date",
};

const fieldPresets = listArxivFieldPresets();

export function DashboardControlBar({
  controls,
  fieldFetchStatus,
  isFetchingField = false,
  resultCount,
  totalCount,
  onChange,
  onFetchField,
  onReset,
}: Readonly<{
  controls: DashboardControlState;
  fieldFetchStatus?: string | null;
  isFetchingField?: boolean;
  resultCount: number;
  totalCount: number;
  onChange: (controls: DashboardControlState) => void;
  onFetchField?: (field: string) => void;
  onReset: () => void;
}>) {
  const selectedField = fieldPresets.find((preset) => preset.id === controls.field) ?? null;
  const fieldFetchDisabled =
    onFetchField === undefined ||
    controls.field === "" ||
    isFetchingField ||
    (controls.field === ARXIV_CUSTOM_FIELD_ID && controls.topic.trim() === "");

  return (
    <section
      aria-label="Dashboard filters"
      className="grid gap-4 border border-[var(--color-border)] bg-[var(--color-panel)] p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal aria-hidden="true" size={17} />
          Controls
        </div>
        <p className="text-sm font-medium text-[var(--color-muted)]">
          {resultCount} / {totalCount}
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1.5fr)_repeat(6,minmax(8rem,1fr))_auto]">
        <label className="grid gap-1 text-sm font-semibold">
          Search
          <span className="relative">
            <Search
              aria-hidden="true"
              className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-muted)]"
              size={16}
            />
            <input
              className="min-h-11 w-full border border-[var(--color-border)] bg-[var(--color-panel)] px-9 py-2 text-sm font-normal outline-none focus:border-[var(--color-accent)]"
              onChange={(event) => onChange({ ...controls, query: event.target.value })}
              placeholder="Title, author, repo, tag"
              type="search"
              value={controls.query}
            />
          </span>
        </label>

        <label className="grid gap-1 text-sm font-semibold">
          Type
          <select
            className="min-h-11 border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm font-normal outline-none focus:border-[var(--color-accent)]"
            onChange={(event) =>
              onChange({ ...controls, type: event.target.value as DashboardTypeFilter })
            }
            value={controls.type}
          >
            <option value="ALL">All</option>
            <option value="PAPER">Papers</option>
            <option value="REPOSITORY">Repositories</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm font-semibold">
          Date
          <input
            className="min-h-11 border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm font-normal outline-none focus:border-[var(--color-accent)]"
            onChange={(event) => onChange({ ...controls, date: event.target.value })}
            type="date"
            value={controls.date}
          />
        </label>

        <label className="grid gap-1 text-sm font-semibold">
          Topic
          <input
            className="min-h-11 border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm font-normal outline-none focus:border-[var(--color-accent)]"
            onChange={(event) => onChange({ ...controls, topic: event.target.value })}
            placeholder="tag, stack, or custom field keywords"
            type="search"
            value={controls.topic}
          />
        </label>

        <label className="grid gap-1 text-sm font-semibold lg:col-span-2">
          Latest Top Papers by Field
          <div className="grid gap-2 min-[420px]:grid-cols-[1fr_auto]">
            <select
              className="min-h-11 border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm font-normal outline-none focus:border-[var(--color-accent)]"
              onChange={(event) =>
                onChange({
                  ...controls,
                  field: event.target.value,
                  type: event.target.value === "" ? controls.type : "PAPER",
                  sort: event.target.value === "" ? controls.sort : "relevance",
                })
              }
              value={controls.field}
            >
              <option value="">All fields</option>
              {fieldPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
            <button
              className="min-h-11 border border-[var(--color-border)] px-3 py-2 text-sm font-semibold transition hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={fieldFetchDisabled}
              onClick={() => onFetchField?.(controls.field)}
              title={
                controls.field === ARXIV_CUSTOM_FIELD_ID && controls.topic.trim() === ""
                  ? "Enter custom keywords in Topic before fetching."
                  : "Fetch the selected field's latest arXiv papers."
              }
              type="button"
            >
              {isFetchingField ? "Fetching…" : "Fetch"}
            </button>
          </div>
          <span className="text-xs font-medium text-[var(--color-muted)]">
            {fieldFetchStatus ??
              (selectedField === null
                ? "Choose a field to focus papers."
                : selectedField.description)}
          </span>
        </label>

        <label className="grid gap-1 text-sm font-semibold">
          Min relevance
          <input
            className="min-h-11 border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm font-normal outline-none focus:border-[var(--color-accent)]"
            max={100}
            min={0}
            onChange={(event) => onChange({ ...controls, minRelevance: event.target.value })}
            placeholder="0-100"
            type="number"
            value={controls.minRelevance}
          />
        </label>

        <label className="grid gap-1 text-sm font-semibold">
          Sort
          <select
            className="min-h-11 border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm font-normal outline-none focus:border-[var(--color-accent)]"
            onChange={(event) =>
              onChange({ ...controls, sort: event.target.value as DashboardSortMode })
            }
            value={controls.sort}
          >
            <option value="date">Date</option>
            <option value="relevance">Relevance</option>
            <option value="stars">Stars</option>
            <option value="updated">Recently updated</option>
          </select>
        </label>

        <button
          aria-label="Reset dashboard controls"
          className="mt-auto inline-flex min-h-11 items-center justify-center border border-[var(--color-border)] px-3 py-2 transition hover:border-[var(--color-accent)]"
          onClick={onReset}
          type="button"
        >
          <RotateCcw aria-hidden="true" size={16} />
        </button>
      </div>
    </section>
  );
}
