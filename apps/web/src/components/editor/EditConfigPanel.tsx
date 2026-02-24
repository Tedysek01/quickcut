"use client";

import { useState } from "react";
import { EditConfig } from "@/types/editConfig";
import { ZoomIntensity } from "@/types/user";
import CaptionStylePicker from "./CaptionStylePicker";
import ZoomControls from "./ZoomControls";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "@/lib/i18n-context";

interface EditConfigPanelProps {
  config: EditConfig;
  onChange: (config: EditConfig) => void;
  onApply: () => void;
  applying: boolean;
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: "1px solid var(--border-subtle)" }} className="last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 text-sm font-medium transition-colors"
        style={{ color: "var(--text-primary)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
      >
        {title}
        <ChevronDown
          className="h-4 w-4 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

export default function EditConfigPanel({
  config,
  onChange,
  onApply,
  applying,
}: EditConfigPanelProps) {
  const { t } = useTranslation();

  const updateConfig = (partial: Partial<EditConfig>) => {
    onChange({ ...config, ...partial });
  };

  return (
    <div className="card p-4">
      <Section title={t("editor.captions")} defaultOpen>
        <CaptionStylePicker
          selected={config.captions.style}
          onChange={(style) =>
            updateConfig({
              captions: { ...config.captions, style },
            })
          }
          primaryColor={config.captions.primaryColor}
          highlightColor={config.captions.highlightColor}
          onPrimaryColorChange={(primaryColor) =>
            updateConfig({
              captions: { ...config.captions, primaryColor },
            })
          }
          onHighlightColorChange={(highlightColor) =>
            updateConfig({
              captions: { ...config.captions, highlightColor },
            })
          }
          fontSize={config.captions.fontSize}
          onFontSizeChange={(fontSize) =>
            updateConfig({
              captions: { ...config.captions, fontSize },
            })
          }
          position={config.captions.position}
          onPositionChange={(position) =>
            updateConfig({
              captions: { ...config.captions, position },
            })
          }
          enabled={config.captions.enabled}
          onEnabledChange={(enabled) =>
            updateConfig({
              captions: { ...config.captions, enabled },
            })
          }
        />
      </Section>

      <Section title={t("editor.zoom")}>
        <ZoomControls
          intensity={
            config.zooms.length > 0
              ? config.zooms[0].scale > 1.2
                ? "aggressive"
                : config.zooms[0].scale > 1.1
                ? "medium"
                : "subtle"
              : "medium"
          }
          onChange={(intensity: ZoomIntensity) => {
            const scaleMap = { subtle: 1.08, medium: 1.15, aggressive: 1.25 };
            updateConfig({
              zooms: config.zooms.map((z) => ({
                ...z,
                scale: scaleMap[intensity],
              })),
            });
          }}
          enabled={config.zooms.length > 0}
          onEnabledChange={(enabled) => {
            if (!enabled) {
              updateConfig({ zooms: [] });
            }
          }}
        />
      </Section>

      <Section title={t("editor.transitions")} defaultOpen={false}>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Select a segment in the timeline to configure its transition.
        </p>
      </Section>

      <Section title={t("editor.audio")} defaultOpen={false}>
        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("editor.audio.normalize")}</span>
            <input
              type="checkbox"
              checked={config.audio.normalizeVolume}
              onChange={(e) =>
                updateConfig({
                  audio: {
                    ...config.audio,
                    normalizeVolume: e.target.checked,
                  },
                })
              }
              className="sr-only peer"
            />
            <div className="toggle" />
          </label>
        </div>
      </Section>

      <Section title={t("editor.output")} defaultOpen={false}>
        <div>
          <label className="text-xs mb-2 block" style={{ color: "var(--text-muted)" }}>
            {t("editor.output.ratio")}
          </label>
          <div className="flex gap-2">
            {(["9:16", "1:1", "4:5"] as const).map((ratio) => {
              const isActive = config.outputRatio === ratio;
              return (
                <button
                  key={ratio}
                  onClick={() => updateConfig({ outputRatio: ratio })}
                  className="flex-1 text-xs py-2 rounded-lg border transition-all"
                  style={{
                    borderColor: isActive ? "var(--accent)" : "var(--border-subtle)",
                    background: isActive ? "var(--accent-muted)" : "transparent",
                    color: isActive ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {ratio}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      <button
        onClick={onApply}
        disabled={applying}
        className="w-full mt-4 btn-accent py-3 text-sm font-medium flex items-center justify-center gap-2"
      >
        {applying ? (
          <>
            <div
              className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--accent-text)", borderTopColor: "transparent" }}
            />
            {t("editor.applying")}
          </>
        ) : (
          t("editor.apply")
        )}
      </button>
    </div>
  );
}
