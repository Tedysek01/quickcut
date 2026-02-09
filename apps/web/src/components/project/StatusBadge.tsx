"use client";

import { ProjectStatus } from "@/types/project";
import { useTranslation } from "@/lib/i18n-context";
import type { TranslationKey } from "@/lib/i18n/en";

const statusConfig: Record<ProjectStatus, { labelKey: TranslationKey; color: string; bg: string }> = {
  uploading: { labelKey: "status.uploading", color: "var(--status-uploading)", bg: "rgba(59, 130, 246, 0.1)" },
  uploaded: { labelKey: "status.processing", color: "var(--status-transcribing)", bg: "rgba(245, 158, 11, 0.1)" },
  transcribing: { labelKey: "status.transcribing", color: "var(--status-transcribing)", bg: "rgba(245, 158, 11, 0.1)" },
  analyzing: { labelKey: "status.analyzing", color: "var(--status-analyzing)", bg: "rgba(167, 139, 250, 0.1)" },
  rendering: { labelKey: "status.rendering", color: "var(--status-rendering)", bg: "rgba(251, 146, 60, 0.1)" },
  done: { labelKey: "status.done", color: "var(--status-done)", bg: "rgba(52, 211, 153, 0.1)" },
  failed: { labelKey: "status.failed", color: "var(--status-failed)", bg: "rgba(255, 71, 87, 0.1)" },
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const { t } = useTranslation();
  const config = statusConfig[status];

  return (
    <span
      className="badge"
      style={{ background: config.bg, color: config.color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: config.color }}
      />
      {t(config.labelKey)}
    </span>
  );
}
