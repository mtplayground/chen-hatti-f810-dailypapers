# chen-hatti-f810-dailypapers

## Snapshot

This project is a Next.js dashboard for collecting research papers and GitHub repositories, summarizing them, annotating them, and exporting curated daily or filtered views.

## Current Capabilities

- Import a single URL, a pasted list of URLs, or Markdown containing links.
- Fetch metadata for arXiv papers, GitHub repositories, and generic paper-like web pages.
- Generate English or Chinese summaries through an OpenAI-compatible chat completions API.
- Review cards for papers and repositories with source links, summary copy, important/archive actions, notes, and tags.
- Search, filter, and sort the dashboard by text, type, date, topic/tag, relevance, stars, and recently updated.
- Fetch new arXiv papers by configured keywords and GitHub repositories by keyword/topic.
- Export the current day or filtered set as Markdown, JSON, or CSV.
- Seed demo papers, repositories, summaries, tags, and notes for local development.

## Architecture

- App framework: Next.js 16 App Router with React 19 and TypeScript.
- Styling: Tailwind CSS 4 with component-level responsive layouts.
- Persistence: PostgreSQL only, accessed through Prisma. SQLite, JSON-file storage, in-memory persistence, and ephemeral disk are not part of the design.
- Data model: shared `items` records with related `papers`, `repositories`, `summaries`, `notes`, `tags`, and `item_tags`.
- API style: Next.js route handlers under `/api/*` for ingestion, search, summarization, daily fetches, item edits, and exports.
- Testing: Node.js built-in test runner covers fetcher parsing, summarization glue, export formatting, and the service-level example workflow.

## Runtime Conventions

- The app runs on `0.0.0.0:8080` via `npm run dev` or `npm run start`.
- `DATABASE_URL` must point to PostgreSQL before Prisma commands, builds that touch data, E2E tests, or runtime use.
- Summarization requires `LLM_API_KEY`; optional LLM settings are `LLM_BASE_URL`, `LLM_MODEL`, `LLM_TEMPERATURE`, and `LLM_TIMEOUT_MS`.
- GitHub metadata and trending fetches use `GITHUB_TOKEN` or `GH_TOKEN`.
- arXiv daily fetch defaults come from `ARXIV_DAILY_KEYWORDS` or `ARXIV_KEYWORDS`; GitHub trending defaults come from `GITHUB_TRENDING_KEYWORDS` and/or `GITHUB_TRENDING_TOPICS`.
- The implemented workflows store text metadata and generated summaries only; object storage is not currently required.

## Primary Workflow

1. Run migrations and seed the PostgreSQL database.
2. Open the dashboard.
3. Import arXiv, GitHub, or Markdown links with optional auto-summarization.
4. Review generated cards, mark important items, archive unwanted items, add notes, and assign tags.
5. Use the control bar to narrow the visible set.
6. Export the current day or filtered set as Markdown, JSON, or CSV.
