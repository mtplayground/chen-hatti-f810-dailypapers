"use client";

import { Moon, Sun } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { messages } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = isDark
    ? messages.shell.controls.switchToLight
    : messages.shell.controls.switchToDark;
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      aria-label={label}
      className="inline-flex size-10 items-center justify-center border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      onClick={toggleTheme}
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" size={18} strokeWidth={2} />
    </button>
  );
}
