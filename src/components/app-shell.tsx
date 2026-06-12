"use client";

import { Archive, Download, Home } from "lucide-react";

import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/components/language-provider";
import { ThemeToggle } from "@/components/theme-toggle";

type NavItem = {
  href: string;
  icon: typeof Home;
  label: string;
};

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const { messages } = useLanguage();
  const navItems: NavItem[] = [
    { href: "#today", icon: Home, label: messages.shell.nav.today },
    { href: "#library", icon: Archive, label: messages.shell.nav.library },
    { href: "#exports", icon: Download, label: messages.shell.nav.exports },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-surface)] text-[var(--color-ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-shell)]/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a className="flex items-center gap-3 font-semibold" href="#today">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center bg-[var(--color-accent)] text-sm text-[var(--color-accent-ink)]"
            >
              <Home size={18} strokeWidth={2} />
            </span>
            <span className="hidden sm:inline">{messages.shell.label}</span>
          </a>

          <nav aria-label="Primary" className="hidden items-center gap-2 md:flex">
            {navItems.map((item) => (
              <a
                className="px-3 py-2 text-sm font-medium text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-24 sm:px-6 lg:px-8">{children}</main>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-border)] bg-[var(--color-shell)]/95 px-3 py-2 backdrop-blur md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-3 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <a
                className="flex h-12 flex-col items-center justify-center gap-1 text-xs font-medium text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
                href={item.href}
                key={item.href}
              >
                <Icon aria-hidden="true" size={18} strokeWidth={2} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
