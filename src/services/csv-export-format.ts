export type CsvCellValue = string | number | boolean | null;

const CSV_HEADERS = [
  "id",
  "kind",
  "created_at",
  "updated_at",
  "important",
  "source_url",
  "canonical_url",
  "title",
  "authors",
  "venue",
  "published_at",
  "revised_at",
  "arxiv_id",
  "doi",
  "paper_url",
  "abstract",
  "relevance_score",
  "relevance_notes",
  "repo_owner",
  "repo_name",
  "repo_url",
  "repo_description",
  "stars",
  "forks",
  "primary_language",
  "last_updated_at",
  "tech_stack",
  "install_difficulty",
  "research_value_score",
  "research_value_notes",
  "tags",
  "summary_en",
  "key_points_en",
  "summary_zh",
  "key_points_zh",
  "notes_en",
  "notes_zh",
] as const;

export function renderCsv(rows: Array<Record<string, CsvCellValue>>): string {
  const csvRows = [
    [...CSV_HEADERS],
    ...rows.map((row) => CSV_HEADERS.map((header) => row[header] ?? "")),
  ];

  return `${csvRows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function csvCell(value: string | number | boolean): string {
  const text = String(value).replace(/\r?\n/g, " ").trim();
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}
