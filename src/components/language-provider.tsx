"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import { type Language, type Messages, messages } from "@/lib/i18n";

type LanguageContextValue = {
  language: Language;
  messages: Messages;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
};

const LANGUAGE_STORAGE_KEY = "daily-papers-language";
const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function isLanguage(value: string | null): value is Language {
  return value === "en" || value === "zh";
}

export function LanguageProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [language, setLanguage] = useState<Language>("en");
  const hasHydrated = useRef(false);

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);

    window.requestAnimationFrame(() => {
      hasHydrated.current = true;

      if (isLanguage(storedLanguage)) {
        setLanguage(storedLanguage);
      }
    });
  }, []);

  useEffect(() => {
    if (!hasHydrated.current) {
      return;
    }

    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      messages: messages[language],
      setLanguage,
      toggleLanguage: () => {
        setLanguage((currentLanguage) => (currentLanguage === "en" ? "zh" : "en"));
      },
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (context === undefined) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }

  return context;
}
