"use client";

import { CaptionStyleType } from "@/types/editConfig";
import { useTranslation } from "@/lib/i18n-context";

interface StyleOption {
  value: CaptionStyleType;
  labelKey: "editor.captions.style.hormozi" | "editor.captions.style.minimal" | "editor.captions.style.karaoke" | "editor.captions.style.bold";
  previewKey: "editor.captions.preview.hormozi" | "editor.captions.preview.minimal" | "editor.captions.preview.karaoke" | "editor.captions.preview.bold";
}

const styles: StyleOption[] = [
  { value: "hormozi", labelKey: "editor.captions.style.hormozi", previewKey: "editor.captions.preview.hormozi" },
  { value: "minimal", labelKey: "editor.captions.style.minimal", previewKey: "editor.captions.preview.minimal" },
  { value: "karaoke", labelKey: "editor.captions.style.karaoke", previewKey: "editor.captions.preview.karaoke" },
  { value: "bold", labelKey: "editor.captions.style.bold", previewKey: "editor.captions.preview.bold" },
];

const fontSizeKeys = {
  small: "editor.captions.fontSize.small",
  medium: "editor.captions.fontSize.medium",
  large: "editor.captions.fontSize.large",
} as const;

const positionKeys = {
  top: "editor.captions.position.top",
  center: "editor.captions.position.center",
  bottom: "editor.captions.position.bottom",
} as const;

interface CaptionStylePickerProps {
  selected: CaptionStyleType;
  onChange: (style: CaptionStyleType) => void;
  primaryColor: string;
  highlightColor: string;
  onPrimaryColorChange: (color: string) => void;
  onHighlightColorChange: (color: string) => void;
  fontSize: "small" | "medium" | "large";
  onFontSizeChange: (size: "small" | "medium" | "large") => void;
  position: "top" | "center" | "bottom";
  onPositionChange: (pos: "top" | "center" | "bottom") => void;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

export default function CaptionStylePicker({
  selected,
  onChange,
  primaryColor,
  highlightColor,
  onPrimaryColorChange,
  onHighlightColorChange,
  fontSize,
  onFontSizeChange,
  position,
  onPositionChange,
  enabled,
  onEnabledChange,
}: CaptionStylePickerProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{t("editor.captions")}</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="toggle" />
        </label>
      </div>

      {enabled && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {styles.map((style) => {
              const isSelected = selected === style.value;
              return (
                <button
                  key={style.value}
                  onClick={() => onChange(style.value)}
                  className="p-3 rounded-lg border text-left transition-all"
                  style={{
                    borderColor: isSelected ? "var(--accent)" : "var(--border-subtle)",
                    background: isSelected ? "var(--accent-muted)" : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.borderColor = "var(--border-default)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.borderColor = "var(--border-subtle)";
                  }}
                >
                  <div
                    className="h-8 rounded flex items-center justify-center text-xs font-bold mb-2"
                    style={{ background: "var(--bg-root)" }}
                  >
                    <span style={{ color: isSelected ? highlightColor : "var(--text-secondary)" }}>
                      {t(style.previewKey)}
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: isSelected ? "var(--accent)" : "var(--text-secondary)" }}>
                    {t(style.labelKey)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>
                {t("editor.captions.textColor")}
              </label>
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => onPrimaryColorChange(e.target.value)}
                className="w-full h-8 rounded cursor-pointer border"
                style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>
                {t("editor.captions.highlightColor")}
              </label>
              <input
                type="color"
                value={highlightColor}
                onChange={(e) => onHighlightColorChange(e.target.value)}
                className="w-full h-8 rounded cursor-pointer border"
                style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs mb-2 block" style={{ color: "var(--text-muted)" }}>
              {t("editor.captions.fontSize")}
            </label>
            <div className="flex gap-2">
              {(["small", "medium", "large"] as const).map((size) => {
                const isActive = fontSize === size;
                return (
                  <button
                    key={size}
                    onClick={() => onFontSizeChange(size)}
                    className="flex-1 text-xs py-1.5 rounded-lg border transition-all capitalize"
                    style={{
                      borderColor: isActive ? "var(--accent)" : "var(--border-subtle)",
                      background: isActive ? "var(--accent-muted)" : "transparent",
                      color: isActive ? "var(--accent)" : "var(--text-muted)",
                    }}
                  >
                    {t(fontSizeKeys[size])}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs mb-2 block" style={{ color: "var(--text-muted)" }}>
              {t("editor.captions.position")}
            </label>
            <div className="flex gap-2">
              {(["top", "center", "bottom"] as const).map((pos) => {
                const isActive = position === pos;
                return (
                  <button
                    key={pos}
                    onClick={() => onPositionChange(pos)}
                    className="flex-1 text-xs py-1.5 rounded-lg border transition-all capitalize"
                    style={{
                      borderColor: isActive ? "var(--accent)" : "var(--border-subtle)",
                      background: isActive ? "var(--accent-muted)" : "transparent",
                      color: isActive ? "var(--accent)" : "var(--text-muted)",
                    }}
                  >
                    {t(positionKeys[pos])}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
