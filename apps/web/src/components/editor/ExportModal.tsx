"use client";

import { useState, useEffect } from "react";
import { useEditorStore } from "@/stores/editorStore";
import {
  X,
  Upload,
  Film,
  Sparkles,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  onExport: (settings: ExportSettings) => void;
  clipStatus?: string; // "rendering" | "done" | "failed"
}

export interface ExportSettings {
  quality: "draft" | "standard" | "high";
  format: "mp4" | "mov";
}

const QUALITY_PRESETS = {
  draft: { label: "Draft", desc: "720p, fast render", crf: 28, scale: 720 },
  standard: { label: "Standard", desc: "1080p, balanced", crf: 23, scale: 1080 },
  high: { label: "High", desc: "1080p+, best quality", crf: 18, scale: 1080 },
} as const;

const RENDER_STAGES = [
  "Preparing timeline...",
  "Applying cuts & segments...",
  "Reframing to vertical...",
  "Applying zoom keyframes...",
  "Rendering captions...",
  "Normalizing audio...",
  "Final encode...",
];

export default function ExportModal({
  open,
  onClose,
  onExport,
  clipStatus,
}: ExportModalProps) {
  const { editConfig } = useEditorStore();
  const [quality, setQuality] = useState<ExportSettings["quality"]>("standard");
  const [format, setFormat] = useState<ExportSettings["format"]>("mp4");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [renderStage, setRenderStage] = useState(0);

  const isRendering = clipStatus === "rendering";
  const isDone = clipStatus === "done";
  const isFailed = clipStatus === "failed";

  // Simulate render stage progression while rendering
  useEffect(() => {
    if (!isRendering) {
      setRenderStage(0);
      return;
    }

    const interval = setInterval(() => {
      setRenderStage((prev) =>
        prev < RENDER_STAGES.length - 1 ? prev + 1 : prev
      );
    }, 3500);

    return () => clearInterval(interval);
  }, [isRendering]);

  // Calculate estimated output duration from segments
  const outputDuration = editConfig?.segments?.reduce(
    (total, seg) => total + (seg.sourceEnd - seg.sourceStart),
    0
  ) ?? 0;

  const segmentCount = editConfig?.segments?.length ?? 0;
  const zoomCount = editConfig?.zooms?.length ?? 0;
  const captionsEnabled = editConfig?.captions?.enabled ?? false;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isRendering) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4" style={{ color: "var(--accent)" }} />
            <h2
              className="text-sm font-semibold"
              style={{ fontFamily: "var(--font-syne)", color: "var(--text-primary)" }}
            >
              Export Video
            </h2>
          </div>
          {!isRendering && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--bg-elevated)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Rendering progress */}
        {isRendering && (
          <div className="px-6 py-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Loader2
                  className="h-8 w-8 animate-spin"
                  style={{ color: "var(--accent)" }}
                />
              </div>
              <div>
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  Rendering...
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {RENDER_STAGES[renderStage]}
                </p>
              </div>
            </div>

            {/* Progress steps */}
            <div className="space-y-1.5">
              {RENDER_STAGES.map((stage, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                    style={{
                      background:
                        i < renderStage
                          ? "var(--accent)"
                          : i === renderStage
                          ? "var(--accent)"
                          : "var(--border)",
                      opacity: i <= renderStage ? 1 : 0.3,
                      boxShadow:
                        i === renderStage
                          ? "0 0 6px var(--accent)"
                          : "none",
                    }}
                  />
                  <span
                    className="text-[11px] transition-colors"
                    style={{
                      color:
                        i <= renderStage
                          ? "var(--text-secondary)"
                          : "var(--text-disabled)",
                    }}
                  >
                    {stage}
                  </span>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div
                className="h-1 rounded-full overflow-hidden"
                style={{ background: "var(--bg-elevated)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    background: "var(--accent)",
                    width: `${((renderStage + 1) / RENDER_STAGES.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Done state */}
        {isDone && (
          <div className="px-6 py-8 text-center space-y-3">
            <CheckCircle2
              className="h-10 w-10 mx-auto"
              style={{ color: "var(--accent)" }}
            />
            <div>
              <p
                className="text-sm font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                Export complete
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Your video is ready to download
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
              style={{ background: "var(--accent)", color: "#000" }}
            >
              Done
            </button>
          </div>
        )}

        {/* Failed state */}
        {isFailed && (
          <div className="px-6 py-8 text-center space-y-3">
            <AlertCircle className="h-10 w-10 mx-auto" style={{ color: "var(--error, #ef4444)" }} />
            <div>
              <p
                className="text-sm font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                Export failed
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Something went wrong during rendering. Please try again.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs transition-colors"
                style={{ color: "var(--text-secondary)", background: "var(--bg-elevated)" }}
              >
                Close
              </button>
              <button
                onClick={() => onExport({ quality, format })}
                className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ background: "var(--accent)", color: "#000" }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Settings (pre-render) */}
        {!isRendering && !isDone && !isFailed && (
          <>
            {/* Summary */}
            <div className="px-6 py-4 space-y-3">
              <div
                className="grid grid-cols-3 gap-2 text-center p-3 rounded-lg"
                style={{ background: "var(--bg-elevated)" }}
              >
                <div>
                  <p
                    className="text-lg font-semibold tabular-nums"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {outputDuration.toFixed(1)}s
                  </p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-disabled)" }}>
                    Duration
                  </p>
                </div>
                <div>
                  <p
                    className="text-lg font-semibold tabular-nums"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {segmentCount}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-disabled)" }}>
                    Segments
                  </p>
                </div>
                <div>
                  <p
                    className="text-lg font-semibold tabular-nums"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {zoomCount}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-disabled)" }}>
                    Zooms
                  </p>
                </div>
              </div>

              {/* Caption badge */}
              {captionsEnabled && (
                <div
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wider"
                  style={{
                    background: "rgba(191, 255, 10, 0.1)",
                    color: "var(--accent)",
                  }}
                >
                  <Sparkles className="h-3 w-3" />
                  Captions enabled ({editConfig?.captions.style})
                </div>
              )}
            </div>

            {/* Quality selector */}
            <div
              className="px-6 py-4 space-y-3"
              style={{ borderTop: "1px solid var(--border-subtle)" }}
            >
              <label
                className="text-[10px] font-semibold uppercase tracking-wider block"
                style={{ color: "var(--text-muted)" }}
              >
                Quality
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(QUALITY_PRESETS) as Array<keyof typeof QUALITY_PRESETS>).map(
                  (key) => {
                    const preset = QUALITY_PRESETS[key];
                    const isSelected = quality === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setQuality(key)}
                        className="p-2.5 rounded-lg text-center transition-all"
                        style={{
                          background: isSelected
                            ? "rgba(191, 255, 10, 0.1)"
                            : "var(--bg-elevated)",
                          border: `1px solid ${
                            isSelected ? "var(--accent)" : "transparent"
                          }`,
                        }}
                      >
                        <p
                          className="text-xs font-medium"
                          style={{
                            color: isSelected
                              ? "var(--accent)"
                              : "var(--text-primary)",
                          }}
                        >
                          {preset.label}
                        </p>
                        <p
                          className="text-[10px] mt-0.5"
                          style={{ color: "var(--text-disabled)" }}
                        >
                          {preset.desc}
                        </p>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Advanced toggle */}
            <div className="px-6">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-[10px] uppercase tracking-wider transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                <ChevronDown
                  className="h-3 w-3 transition-transform"
                  style={{
                    transform: showAdvanced ? "rotate(180deg)" : "rotate(0)",
                  }}
                />
                Advanced
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-3 pb-2">
                  <div>
                    <label
                      className="text-[10px] uppercase tracking-wider block mb-1"
                      style={{ color: "var(--text-disabled)" }}
                    >
                      Format
                    </label>
                    <select
                      value={format}
                      onChange={(e) => setFormat(e.target.value as ExportSettings["format"])}
                      className="input w-full text-xs"
                    >
                      <option value="mp4">MP4 (H.264)</option>
                      <option value="mov">MOV (ProRes)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Export button */}
            <div className="px-6 py-4">
              <button
                onClick={() => onExport({ quality, format })}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: "var(--accent)",
                  color: "#000",
                  fontFamily: "var(--font-syne)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <Upload className="h-4 w-4" />
                Start Export
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
