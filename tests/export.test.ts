import assert from "node:assert/strict";
import test from "node:test";

import { ItemKind } from "@prisma/client";

import { renderCsv } from "../src/services/csv-export-format";
import {
  exportFilename,
  filterAndSortExportItems,
  parseExportItemsQuery,
} from "../src/services/export-filters";
import type { ExportFilterableItem } from "../src/services/export-filters";

void test("renderCsv writes stable headers and escapes spreadsheet-sensitive cells", () => {
  const csv = renderCsv([
    {
      id: "paper-1",
      kind: "PAPER",
      title: '=IMPORTXML("https://example.test")',
      abstract: "line one\nline two",
      summary_en: 'quoted "summary"',
      important: true,
      stars: null,
    },
  ]);

  const lines = csv.trimEnd().split("\n");
  assert.match(lines[0] ?? "", /^"id","kind","created_at"/);
  assert.match(csv, /"'=IMPORTXML\(""https:\/\/example\.test""\)"/);
  assert.match(csv, /"line one line two"/);
  assert.match(csv, /"quoted ""summary"""/);
  assert.ok(csv.endsWith("\n"));
});

void test("export filenames distinguish date-only and filtered exports", () => {
  const dayQuery = parseExportItemsQuery({ date: "2026-06-12" });
  const filteredQuery = parseExportItemsQuery({ date: "2026-06-12", q: "retrieval" });
  const unfilteredQuery = parseExportItemsQuery({});

  assert.equal(exportFilename("json", dayQuery), "daily-papers-2026-06-12.json");
  assert.equal(exportFilename("csv", filteredQuery), "daily-papers-filtered.csv");
  assert.equal(exportFilename("md", unfilteredQuery), "daily-papers-items.md");
});

void test("filterAndSortExportItems applies text, topic, relevance, and sort rules", () => {
  const items: ExportFilterableItem[] = [
    {
      kind: ItemKind.PAPER,
      createdAt: new Date("2026-06-10T00:00:00.000Z"),
      paper: {
        title: "Graph retrieval",
        authors: ["Ada Lovelace"],
        venue: "arXiv",
        abstract: "RAG over graphs.",
        problemStatement: null,
        methodology: null,
        keyFindings: null,
        limitations: null,
        relevanceScore: 75,
        relevanceNotes: "Relevant",
        publishedAt: new Date("2026-06-09T00:00:00.000Z"),
        revisedAt: null,
      },
      repository: null,
      summaries: [],
      tags: [{ tag: { slug: "rag", nameEn: "RAG", nameZh: null, color: null } }],
    },
    {
      kind: ItemKind.REPOSITORY,
      createdAt: new Date("2026-06-11T00:00:00.000Z"),
      paper: null,
      repository: {
        owner: "openai",
        name: "retrieval-kit",
        description: "RAG utilities",
        primaryLanguage: "TypeScript",
        readme: "Search and retrieval tools.",
        techStack: ["TypeScript"],
        installNotes: null,
        researchValueScore: 90,
        researchValueNotes: "Very relevant",
        stars: 1200,
        lastUpdatedAt: new Date("2026-06-12T00:00:00.000Z"),
      },
      summaries: [],
      tags: [{ tag: { slug: "rag", nameEn: "RAG", nameZh: null, color: null } }],
    },
  ];

  const filtered = filterAndSortExportItems(
    items,
    parseExportItemsQuery({
      q: "retrieval",
      topic: "rag",
      minRelevance: "80",
      sort: "stars",
    }),
  );

  assert.equal(filtered.length, 1);
  const item = filtered[0];
  assert.ok(item);
  assert.equal(item.kind, ItemKind.REPOSITORY);
});
