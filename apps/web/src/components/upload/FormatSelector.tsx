"use client";

import { VideoFormat } from "@/types/project";
import { User, Mic, ShoppingBag, GraduationCap, Sparkles } from "lucide-react";
import { useTranslation } from "@/lib/i18n-context";
import type { TranslationKey } from "@/lib/i18n/en";

interface FormatOption {
  value: VideoFormat;
  labelKey: TranslationKey;
  descKey: TranslationKey;
  icon: typeof User;
  available: boolean;
}

const formats: FormatOption[] = [
  { value: "talking_head", labelKey: "upload.format.portrait", descKey: "upload.format.portraitDesc", icon: User, available: true },
  { value: "podcast", labelKey: "upload.format.square", descKey: "upload.format.squareDesc", icon: Mic, available: false },
  { value: "ugc", labelKey: "upload.format.tallPortrait", descKey: "upload.format.tallPortraitDesc", icon: ShoppingBag, available: false },
  { value: "educational", labelKey: "upload.format.tallPortrait", descKey: "upload.format.tallPortraitDesc", icon: GraduationCap, available: false },
  { value: "entertainment", labelKey: "upload.format.tallPortrait", descKey: "upload.format.tallPortraitDesc", icon: Sparkles, available: false },
];

export default function FormatSelector({ selected, onChange }: { selected: VideoFormat; onChange: (f: VideoFormat) => void }) {
  const { t } = useTranslation();

  return (
    <div>
      <label className="block text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>{t("upload.format.title")}</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {formats.map((f) => {
          const active = selected === f.value;
          return (
            <button
              key={f.value}
              onClick={() => f.available && onChange(f.value)}
              className="relative flex flex-col items-start p-4 rounded-xl text-left transition-all duration-200"
              style={{
                background: active ? "var(--accent-glow)" : "var(--bg-card)",
                border: `1px solid ${active ? "var(--accent)" : "var(--border-subtle)"}`,
                opacity: f.available ? 1 : 0.5,
                cursor: f.available ? "pointer" : "not-allowed",
              }}
            >
              {!f.available && (
                <span className="absolute top-2 right-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: "var(--bg-elevated)", color: "var(--text-disabled)" }}>{t("upload.format.soon")}</span>
              )}
              <f.icon className="h-5 w-5 mb-2" style={{ color: active ? "var(--accent)" : "var(--text-muted)" }} />
              <span className="text-sm font-medium">{t(f.labelKey)}</span>
              <span className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{t(f.descKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
