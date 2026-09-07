"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { english } from "../lib/translations";

export type Language = "ja" | "en";
export function translate(language: Language, text: string, ...values: Array<string | number>): string {
  const translated = language === "en" ? english[text] || text : text;
  return translated.replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)] ?? ""));
}
const LanguageContext = createContext({ language: "ja" as Language, setLanguage: (_value: Language) => {} });
export function LanguageProvider({ children, initialLanguage = "ja" }: { children: ReactNode; initialLanguage?: Language }) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  useEffect(() => {
    try { if (localStorage.getItem("loop-language") === "en") setLanguage("en"); } catch { /* Storage is optional. */ }
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === "en" ? "Loop — Learn, understand, and remember" : "Loop — 知識を小さくして覚え、深く理解する";
  }, [language]);
  const changeLanguage = (value: Language) => {
    setLanguage(value);
    try { localStorage.setItem("loop-language", value); } catch { /* Keep working when storage is disabled. */ }
  };
  return <LanguageContext.Provider value={{ language, setLanguage: changeLanguage }}>{children}</LanguageContext.Provider>;
}
export function useLanguage() {
  const { language, setLanguage } = useContext(LanguageContext);
  return { language, setLanguage, locale: language === "en" ? "en-US" : "ja-JP", t: (text: string, ...values: Array<string | number>) => translate(language, text, ...values) };
}
