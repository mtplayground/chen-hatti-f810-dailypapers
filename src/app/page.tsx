const focusAreas = [
  "Collect papers and repositories",
  "Prepare bilingual summaries",
  "Track notes, tags, and exports",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--color-surface)] text-[var(--color-ink)]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-[var(--color-border)] pb-5">
          <div>
            <p className="text-sm font-medium text-[var(--color-muted)]">Daily research intake</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal sm:text-3xl">
              Papers and repositories, ready for the next workflow.
            </h1>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="max-w-2xl">
            <p className="text-base leading-7 text-[var(--color-muted)] sm:text-lg">
              This App Router baseline establishes the TypeScript and Tailwind foundation that later
              issues can extend with ingestion, summarization, search, notes, and exports.
            </p>
          </div>

          <div className="grid gap-3">
            {focusAreas.map((area) => (
              <div
                key={area}
                className="border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3 text-sm font-medium shadow-sm"
              >
                {area}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
