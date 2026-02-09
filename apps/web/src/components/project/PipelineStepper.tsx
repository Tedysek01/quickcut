"use client";

import { useEffect, useState } from "react";
import { ProjectStatus } from "@/types/project";
import { useTranslation } from "@/lib/i18n-context";
import { Check, AlertTriangle, Loader2 } from "lucide-react";
import type { Timestamp } from "firebase/firestore";

const PIPELINE_STEPS: { status: ProjectStatus; labelKey: string; color: string }[] = [
  { status: "uploaded", labelKey: "pipeline.step.queued", color: "var(--status-uploading)" },
  { status: "transcribing", labelKey: "pipeline.step.transcribing", color: "var(--status-transcribing)" },
  { status: "analyzing", labelKey: "pipeline.step.analyzing", color: "var(--status-analyzing)" },
  { status: "rendering", labelKey: "pipeline.step.rendering", color: "var(--status-rendering)" },
];

const STATUS_ORDER: ProjectStatus[] = ["uploaded", "transcribing", "analyzing", "rendering", "done"];

// Per-step timeout in seconds before showing "stuck" warning
const STUCK_THRESHOLDS: Record<string, number> = {
  uploaded: 120,      // 2 min — waiting for Cloud Function
  transcribing: 300,  // 5 min — Deepgram + download
  analyzing: 180,     // 3 min — Gemini analysis
  rendering: 600,     // 10 min — FFmpeg on GPU
};

function getStepIndex(status: ProjectStatus): number {
  return STATUS_ORDER.indexOf(status);
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface PipelineStepperProps {
  status: ProjectStatus;
  startedAt: Timestamp | null;
  clipsDone?: number;
  clipsTotal?: number;
}

export function PipelineStepper({ status, startedAt, clipsDone = 0, clipsTotal = 0 }: PipelineStepperProps) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const start = startedAt.toDate().getTime();

    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const currentIndex = getStepIndex(status);
  const stuckThreshold = STUCK_THRESHOLDS[status] ?? 300;
  const isStuck = startedAt != null && elapsed > stuckThreshold;

  return (
    <div className="card p-6 sm:p-8">
      {/* Stepper row: icons + connectors */}
      <div className="flex items-center mb-2 px-4">
        {PIPELINE_STEPS.map((step, i) => {
          const stepIndex = getStepIndex(step.status);
          const isDone = currentIndex > stepIndex;
          const isActive = status === step.status;

          return (
            <div key={step.status} className="contents">
              {/* Step circle */}
              <div className="flex flex-col items-center shrink-0" style={{ width: 28 }}>
                {isDone ? (
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center"
                    style={{ background: "var(--status-done)" }}
                  >
                    <Check className="h-4 w-4" style={{ color: "var(--bg-root)" }} />
                  </div>
                ) : isActive ? (
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center"
                    style={{ background: step.color, boxShadow: `0 0 14px ${step.color}40` }}
                  >
                    <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--bg-root)" }} />
                  </div>
                ) : (
                  <div
                    className="h-7 w-7 rounded-full border-2"
                    style={{ borderColor: "var(--border)" }}
                  />
                )}
              </div>

              {/* Connector line */}
              {i < PIPELINE_STEPS.length - 1 && (
                <div
                  className="flex-1 h-px mx-2"
                  style={{
                    background: isDone ? "var(--status-done)" : "var(--border-subtle)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Labels row */}
      <div className="flex justify-between mb-6 px-4">
        {PIPELINE_STEPS.map((step) => {
          const stepIndex = getStepIndex(step.status);
          const isDone = currentIndex > stepIndex;
          const isActive = status === step.status;

          return (
            <span
              key={step.status}
              className="text-[11px] font-medium text-center"
              style={{
                width: 60,
                color: isDone
                  ? "var(--status-done)"
                  : isActive
                    ? "var(--text-primary)"
                    : "var(--text-disabled)",
              }}
            >
              {t(step.labelKey as any)}
            </span>
          );
        })}
      </div>

      {/* Status detail + timer */}
      <div className="text-center">
        <p className="text-sm font-medium mb-1">
          {status === "rendering" && clipsTotal > 0
            ? `${t("pipeline.rendering.progress" as any)} — ${clipsDone}/${clipsTotal}`
            : t(`pipeline.detail.${status}` as any)}
        </p>
        {startedAt && (
          <p className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
            {formatElapsed(elapsed)}
          </p>
        )}
      </div>

      {/* Stuck warning */}
      {isStuck && (
        <div
          className="flex items-center gap-2 mt-5 px-4 py-3 rounded-lg text-sm"
          style={{
            background: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
            color: "var(--status-transcribing)",
          }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{t("pipeline.stuck" as any)}</span>
        </div>
      )}
    </div>
  );
}
