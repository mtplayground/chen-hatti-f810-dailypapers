"use client";

import { useLanguage } from "@/components/language-provider";

export function LanguageToggle() {
  const { language, messages, setLanguage } = useLanguage();

  return (
    <div
      aria-label={messages.shell.controls.language}
      className="inline-grid grid-cols-2 border border-[var(--color-border)] bg-[var(--color-panel)] p-1"
      role="group"
    >
      <button
        aria-pressed={language === "en"}
        className="h-8 px-3 text-sm font-medium transition aria-pressed:bg-[var(--color-accent)] aria-pressed:text-[var(--color-accent-ink)]"
        onClick={() => setLanguage("en")}
        type="button"
      >
        EN
      </button>
      <button
        aria-pressed={language === "zh"}
        className="h-8 px-3 text-sm font-medium transition aria-pressed:bg-[var(--color-accent)] aria-pressed:text-[var(--color-accent-ink)]"
        onClick={() => setLanguage("zh")}
        type="button"
      >
        中文
      </button>
    </div>
  );
}
