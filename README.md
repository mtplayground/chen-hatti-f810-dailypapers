# chen-hatti-f810-dailypapers

This application is a Next.js dashboard for collecting research papers and GitHub repositories, generating summaries, adding personal notes and tags, and exporting the saved set as Markdown, JSON, or CSV.

## What It Does

- Imports a single URL, a pasted URL list, or a Markdown file containing links.
- Fetches metadata for arXiv papers, GitHub repositories, and generic paper-like web pages.
- Summarizes papers and repositories with an OpenAI-compatible chat completions API.
- Stores items, summaries, notes, tags, and status flags in PostgreSQL through Prisma.
- Supports daily arXiv keyword fetches, Hugging Face Daily Papers Top-5 ingestion, and a GitHub fastest-growing Top-5 approximation.
- Filters and sorts the dashboard by query, type, date, topic, relevance, stars, and recent updates.
- Exports the current day or filtered set as Markdown, JSON, or CSV.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Prisma 6
- PostgreSQL
- Node.js built-in test runner
- Tailwind CSS 4

## Requirements

- Node.js 20.9 or newer
- npm
- PostgreSQL database URL in `DATABASE_URL`
- LLM API key for summarization
- GitHub token for repository metadata and fastest-growing repository fetches

Persistent state must use PostgreSQL. Do not switch this app to SQLite, local JSON files, in-memory storage, or ephemeral disk.

## Environment

Create a local `.env` from the example file:

```bash
cp .env.example .env
```

For the provisioned workspace, the database URL is already available:

```bash
export DATABASE_URL=$(cat /workspace/.database_url)
```

The application reads these variables:

| Variable                               | Required                               | Purpose                                                                                                                |
| -------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                         | Yes                                    | PostgreSQL connection string used by Prisma.                                                                           |
| `LLM_API_KEY`                          | Yes for summarization                  | API key sent as a bearer token to the chat completions endpoint.                                                       |
| `LLM_BASE_URL`                         | No                                     | OpenAI-compatible API base URL. Defaults to `https://api.openai.com/v1`.                                               |
| `LLM_MODEL`                            | No                                     | Model used for summary generation. Defaults to `gpt-4o-mini`.                                                          |
| `LLM_TEMPERATURE`                      | No                                     | Summary generation temperature. Defaults to `0.2`.                                                                     |
| `LLM_TIMEOUT_MS`                       | No                                     | LLM request timeout in milliseconds. Defaults to `30000`.                                                              |
| `GITHUB_TOKEN`                         | Yes for GitHub fetches                 | Token for GitHub repository and fastest-growing API calls. `GH_TOKEN` is also accepted by lower-level GitHub fetchers. |
| `ARXIV_DAILY_KEYWORDS`                 | Required for default arXiv daily fetch | Comma- or newline-separated arXiv search keywords. `ARXIV_KEYWORDS` is also accepted.                                  |
| `ARXIV_DAILY_MAX_RESULTS`              | No                                     | Default max arXiv daily fetch results. Defaults to `10`; max is `50`.                                                  |
| `HUGGINGFACE_DAILY_PAPERS_MAX_RESULTS` | No                                     | Default max Hugging Face Daily Papers results. Defaults to `5`; max is `50`.                                           |
| `GITHUB_FAST_GROWING_MAX_RESULTS`      | No                                     | Default max GitHub fastest-growing repositories to ingest. Defaults to `5`; max is `50`.                               |
| `GITHUB_FAST_GROWING_LOOKBACK_DAYS`    | No                                     | Created/pushed lookback window for fastest-growing candidates. Defaults to `7`; max is `365`.                          |
| `GITHUB_FAST_GROWING_CANDIDATE_LIMIT`  | No                                     | Number of recent GitHub search candidates to rank before taking the top repositories. Defaults to `25`; max is `100`.  |

The current app stores text metadata and generated summaries only. It does not require object-storage credentials for the implemented workflows.

## Local Setup

Install dependencies:

```bash
npm install
```

Generate the Prisma client:

```bash
npm run prisma:generate
```

Validate the schema:

```bash
npm run prisma:validate
```

Apply migrations to the configured PostgreSQL database:

```bash
npm run db:migrate
```

Seed sample tags, papers, repositories, summaries, and notes:

```bash
npm run db:seed
```

Run the development server on `0.0.0.0:8080`:

```bash
npm run dev
```

Open `http://localhost:8080`.

## Production Build

```bash
npm run build
npm run start
```

`npm run start` also listens on `0.0.0.0:8080`.

## Useful Scripts

| Command                | Purpose                                                                   |
| ---------------------- | ------------------------------------------------------------------------- |
| `npm run dev`          | Start the local Next.js dev server.                                       |
| `npm run build`        | Build the production app.                                                 |
| `npm run start`        | Start the built app on port `8080`.                                       |
| `npm run lint`         | Run ESLint with zero warnings allowed.                                    |
| `npm run typecheck`    | Run TypeScript without emitting files.                                    |
| `npm run test`         | Run unit tests for fetchers, summarizers, and export formatting.          |
| `npm run test:e2e`     | Run the example workflow test against the configured PostgreSQL database. |
| `npm run format`       | Format the repository with Prettier.                                      |
| `npm run format:check` | Check formatting without writing changes.                                 |
| `npm run db:migrate`   | Apply Prisma migrations with `prisma migrate deploy`.                     |
| `npm run db:seed`      | Seed demo data with `prisma db seed`.                                     |

## Example Workflow

1. Start the app and open the dashboard.
2. Select **Add Item**.
3. Paste one arXiv URL, one GitHub repository URL, a batch of URLs, or a Markdown file containing links.
4. Leave **Auto summarize** enabled to fetch metadata and generate summaries during import.
5. Review the imported paper or repository cards.
6. Mark items as important, archive items that should disappear from active views, copy summaries, or open the source links.
7. Expand a card and add personal notes in English or Chinese.
8. Create or assign tags from the card editor.
9. Use the control bar to search, filter, and sort the visible set.
10. Export either the current day or the filtered set as Markdown, JSON, or CSV.

The E2E test exercises this same flow at the service layer:

```bash
export DATABASE_URL=$(cat /workspace/.database_url)
npm run test:e2e
```

## Import APIs

The UI uses these routes:

- `POST /api/ingest/url` with `{ "url": "...", "important": false, "autoSummarize": true }`
- `POST /api/ingest/batch` with `{ "urls": "https://...\nhttps://...", "important": false, "autoSummarize": true }`
- `POST /api/ingest/markdown` with JSON or multipart form data containing Markdown text or a Markdown file

Supported URL types:

- arXiv abstracts such as `https://arxiv.org/abs/1706.03762`
- GitHub repositories such as `https://github.com/vercel/next.js`
- Generic web pages with paper-like metadata

## Summarization APIs

- `POST /api/papers/:itemId/summarize`
- `POST /api/repositories/:itemId/summarize`

Summarization uses `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_TEMPERATURE`, and `LLM_TIMEOUT_MS`. Responses are validated before they are persisted as `summaries`.

## Daily Fetch APIs

Unified daily fetch runs both new daily sources in one request:

- Hugging Face Daily Papers Top 5, sorted by attention/upvotes, stored as `Paper` items with `source: "huggingface-daily"`, `hfLikes`, and `hfRank` in the paper analysis payload.
- GitHub fastest-growing Top 5 approximation, using recent created/pushed search windows sorted by stars, stored or updated as `Repository` items.

```bash
curl "http://localhost:8080/api/daily-fetch?maxResults=5&dryRun=true&autoSummarize=false"
```

The route accepts `GET` query parameters or a `POST` JSON body and returns `{ "papers": ..., "repositories": ... }` with per-source `fetched`, `ingested`, `skipped`, and `failed` counts. Set `dryRun=false` or omit it to persist items. Set `autoSummarize=false` if you want to import metadata without calling the LLM.

Example `POST` body with separate GitHub candidate settings:

```json
{
  "maxResults": 5,
  "autoSummarize": false,
  "repositories": {
    "candidateLimit": 25,
    "lookbackDays": 7
  }
}
```

The arXiv keyword route remains available for arXiv-specific pulls:

```bash
curl "http://localhost:8080/api/arxiv/daily-fetch?keywords=agentic%20rag,llm&maxResults=5&dryRun=true"
```

## Export APIs

Dashboard buttons call these routes:

- `GET /api/export/markdown`
- `GET /api/export/json`
- `GET /api/export/csv`

Common query parameters:

| Parameter      | Values                                            |
| -------------- | ------------------------------------------------- |
| `date`         | UTC date as `YYYY-MM-DD`.                         |
| `q`            | Search text.                                      |
| `type`         | `PAPER` or `REPOSITORY`.                          |
| `topic`        | Comma-separated tags, topics, or tech stack text. |
| `minRelevance` | Integer from `0` to `100`.                        |
| `sort`         | `date`, `relevance`, `stars`, or `updated`.       |
| `language`     | `EN` or `ZH` for Markdown summary selection.      |

Examples:

```bash
curl -OJ "http://localhost:8080/api/export/markdown?date=2026-06-12&language=EN"
curl -OJ "http://localhost:8080/api/export/json?q=rag&type=PAPER&sort=relevance"
curl -OJ "http://localhost:8080/api/export/csv?topic=database&sort=updated"
```

## Database Notes

The Prisma schema defines:

- `items` as the shared record for papers and repositories.
- `papers` and `repositories` for source-specific metadata.
- `summaries` for generated English and Chinese summaries.
- `tags` and `item_tags` for reusable tagging.
- `notes` for personal notes per item and language.

Seed data is idempotent enough for repeated local setup: existing canonical URLs and tag slugs are reused or updated by the seed script.

## Troubleshooting

- Missing `DATABASE_URL`: export it before any Prisma command or app run.
- LLM calls fail with configuration errors: set `LLM_API_KEY`; optionally confirm `LLM_BASE_URL` points at an OpenAI-compatible `/chat/completions` API.
- GitHub fetches fail with authentication or rate-limit errors: set `GITHUB_TOKEN` or `GH_TOKEN`.
- Daily fetch routes return configuration errors: confirm numeric daily-source limits are within range and set `GITHUB_TOKEN` for GitHub fastest-growing fetches.
- Seed or E2E commands fail against an empty database: run `npm run db:migrate` first.
- Duplicate URL imports return conflicts or skipped items because canonical URLs are unique.
