"use client";

import { VideoLanguage } from "@/types/project";
import { Languages } from "lucide-react";
import { useTranslation } from "@/lib/i18n-context";
import type { TranslationKey } from "@/lib/i18n/en";

interface LanguageOption {
  value: VideoLanguage;
  labelKey: TranslationKey;
  flag: string;
}

const languages: LanguageOption[] = [
  { value: "cs", labelKey: "upload.language.cs", flag: "🇨🇿" },
  { value: "en", labelKey: "upload.language.en", flag: "🇬🇧" },
  { value: "de", labelKey: "upload.language.de", flag: "🇩🇪" },
  { value: "es", labelKey: "upload.language.es", flag: "🇪🇸" },
  { value: "fr", labelKey: "upload.language.fr", flag: "🇫🇷" },
  { value: "pl", labelKey: "upload.language.pl", flag: "🇵🇱" },
  { value: "pt", labelKey: "upload.language.pt", flag: "🇵🇹" },
  { value: "it", labelKey: "upload.language.it", flag: "🇮🇹" },
  { value: "nl", labelKey: "upload.language.nl", flag: "🇳🇱" },
  { value: "sv", labelKey: "upload.language.sv", flag: "🇸🇪" },
  { value: "ja", labelKey: "upload.language.ja", flag: "🇯🇵" },
  { value: "ko", labelKey: "upload.language.ko", flag: "🇰🇷" },
  { value: "zh", labelKey: "upload.language.zh", flag: "🇨🇳" },
];

export default function LanguageSelector({ selected, onChange }: { selected: VideoLanguage; onChange: (l: VideoLanguage) => void }) {
  const { t } = useTranslation();

  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>
        <Languages className="h-4 w-4" />
        {t("upload.language.title")}
      </label>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {languages.map((lang) => {
          const active = selected === lang.value;
          return (
            <button
              key={lang.value}
              onClick={() => onChange(lang.value)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all duration-200"
              style={{
                background: active ? "var(--accent-glow)" : "var(--bg-card)",
                border: `1px solid ${active ? "var(--accent)" : "var(--border-subtle)"}`,
              }}
            >
              <span className="text-base">{lang.flag}</span>
              <span className="text-sm font-medium truncate">{t(lang.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
