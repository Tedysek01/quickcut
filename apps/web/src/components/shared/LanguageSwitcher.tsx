"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "@/lib/i18n-context";
import { type Locale, locales } from "@/lib/i18n";
import { Globe } from "lucide-react";

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
        style={{
          color: "var(--text-muted)",
          background: open ? "var(--bg-secondary)" : "transparent",
        }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.background = "var(--bg-secondary)";
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.background = "transparent";
        }}
      >
        <Globe className="h-3.5 w-3.5" />
        {!compact && (
          <span>{locales[locale].flag} {locales[locale].label}</span>
        )}
        {compact && <span>{locales[locale].flag}</span>}
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 mb-1 rounded-xl overflow-hidden shadow-lg z-50"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            minWidth: "140px",
          }}
        >
          {(Object.keys(locales) as Locale[]).map((loc) => {
            const isActive = loc === locale;
            return (
              <button
                key={loc}
                onClick={() => {
                  setLocale(loc);
                  setOpen(false);
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-xs transition-colors text-left cursor-pointer"
                style={{
                  background: isActive ? "var(--accent-glow)" : "transparent",
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "var(--bg-elevated)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = isActive ? "var(--accent-glow)" : "transparent";
                }}
              >
                <span>{locales[loc].flag}</span>
                <span>{locales[loc].label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
