"use client";

import { ZoomIntensity } from "@/types/user";
import { useTranslation } from "@/lib/i18n-context";

const intensityLabelKeys = {
  subtle: "editor.zoom.subtle",
  medium: "editor.zoom.medium",
  aggressive: "editor.zoom.aggressive",
} as const;

const intensityDescKeys = {
  subtle: "editor.zoom.desc.subtle",
  medium: "editor.zoom.desc.medium",
  aggressive: "editor.zoom.desc.aggressive",
} as const;

interface ZoomControlsProps {
  intensity: ZoomIntensity;
  onChange: (intensity: ZoomIntensity) => void;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

export default function ZoomControls({
  intensity,
  onChange,
  enabled,
  onEnabledChange,
}: ZoomControlsProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{t("editor.zoom")}</h3>
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
        <div>
          <label className="text-xs mb-2 block" style={{ color: "var(--text-muted)" }}>{t("editor.zoom.intensity")}</label>
          <div className="flex gap-2">
            {(["subtle", "medium", "aggressive"] as const).map((level) => {
              const isActive = intensity === level;
              return (
                <button
                  key={level}
                  onClick={() => onChange(level)}
                  className="flex-1 text-xs py-2 rounded-lg border transition-all capitalize"
                  style={{
                    borderColor: isActive ? "var(--accent)" : "var(--border-subtle)",
                    background: isActive ? "var(--accent-muted)" : "transparent",
                    color: isActive ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {t(intensityLabelKeys[level])}
                </button>
              );
            })}
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--text-disabled)" }}>
            {t(intensityDescKeys[intensity])}
          </p>
        </div>
      )}
    </div>
  );
}
