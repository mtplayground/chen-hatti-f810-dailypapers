# chen-hatti-f810-dailypapers

## Snapshot

This project is a Next.js research dashboard for collecting AI papers and GitHub repositories, generating bilingual summaries, annotating saved items, and exporting curated daily or filtered views.

## Current Capabilities

- Import a single URL, pasted URL list, or Markdown containing links.
- Fetch metadata for arXiv papers, Hugging Face Daily Papers, GitHub repositories, and generic paper-like web pages.
- Run daily-source ingestion from:
  - arXiv keyword searches and field presets.
  - Hugging Face Daily Papers Top 5, sorted by likes/upvotes.
  - GitHub fastest-growing Top 5 approximation, using recent created/pushed windows and stars sorting.
  - A unified `/api/daily-fetch` endpoint that runs Hugging Face papers plus GitHub fastest-growing repositories together.
- Pick arXiv field presets in the dashboard: LLM/Agents, Computer Vision, Robotics, NLP, Systems, or Custom.
- Use the “Latest Top Papers by Field” dashboard controls and fetch panel to filter field-specific papers, set max results, toggle auto-summarization, run `POST /api/arxiv/daily-fetch`, view fetched/ingested/skipped/failed counts, and refresh on success.
- Generate English and Chinese summaries through an OpenAI-compatible chat completions API.
- Review paper and repository cards with source links, copyable summaries, important/archive actions, notes, and tags.
- Search, filter, and sort the dashboard by text, type, date, topic/tag/stack, field, relevance, stars, and recently updated.
- Export the current day or filtered set as Markdown, JSON, or CSV.
- Seed demo papers, repositories, summaries, tags, and notes for local development.

## Architecture

- App framework: Next.js 16 App Router with React 19 and TypeScript.
- Styling: Tailwind CSS 4 with component-level responsive layouts.
- Persistence: PostgreSQL only, accessed through Prisma. SQLite, JSON-file storage, in-memory persistence, and ephemeral disk are not part of the design.
- Data model: shared `items` records with related `papers`, `repositories`, `summaries`, `notes`, `tags`, and `item_tags`.
- Fetchers: source-specific modules under `src/fetchers/*`; ingestion and daily-source orchestration live under `src/services/*`.
- API style: Next.js route handlers under `/api/*` for ingestion, search, summarization, daily fetches, item edits, and exports.
- Testing: Node.js built-in test runner covers fetcher parsing, daily-source ranking, arXiv field preset mapping, fetch-panel payloads, summarization glue, export formatting, and the service-level example workflow.

## Runtime Conventions

- The app runs on `0.0.0.0:8080` via `npm run dev` or `npm run start`.
- `DATABASE_URL` must point to PostgreSQL before Prisma commands, builds that touch data, E2E tests, or runtime use.
- Summarization requires `LLM_API_KEY`; optional LLM settings are `LLM_BASE_URL`, `LLM_MODEL`, `LLM_TEMPERATURE`, and `LLM_TIMEOUT_MS`.
- GitHub metadata and fastest-growing fetches use `GITHUB_TOKEN` or `GH_TOKEN`.
- arXiv daily fetch defaults come from `ARXIV_DAILY_KEYWORDS` or `ARXIV_KEYWORDS`; `ARXIV_DAILY_MAX_RESULTS` controls default arXiv result count.
- Daily-source defaults include `HUGGINGFACE_DAILY_PAPERS_MAX_RESULTS`, `GITHUB_FAST_GROWING_MAX_RESULTS`, `GITHUB_FAST_GROWING_LOOKBACK_DAYS`, and `GITHUB_FAST_GROWING_CANDIDATE_LIMIT`.
- The implemented workflows store text metadata and generated summaries only; object storage is not currently required.

## Primary Workflow

1. Run migrations and seed the PostgreSQL database.
2. Open the dashboard.
3. Import arXiv, GitHub, or Markdown links with optional auto-summarization.
4. Fetch latest papers/repositories from arXiv field presets, Hugging Face Daily Papers, or GitHub fastest-growing sources.
5. Review generated cards, mark important items, archive unwanted items, add notes, and assign tags.
6. Use the control bar to narrow the visible set.
7. Export the current day or filtered set as Markdown, JSON, or CSV.
