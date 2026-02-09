"use client";

import { Clip } from "@/types/clip";
import Link from "next/link";
import { Play, Download, TrendingUp, AlertCircle } from "lucide-react";
import { useTranslation } from "@/lib/i18n-context";

interface ClipCardProps {
  clip: Clip & { id: string };
  projectId: string;
}

export default function ClipCard({ clip, projectId }: ClipCardProps) {
  const { t } = useTranslation();
  const isReady = clip.status === "done";
  const isRendering = clip.status === "rendering" || clip.status === "pending";

  return (
    <div className="card card-interactive overflow-hidden group">
      <div
        className="aspect-[9/16] max-h-64 relative flex items-center justify-center"
        style={{ background: "var(--bg-elevated)" }}
      >
        {clip.rendered?.thumbnailUrl ? (
          <img src={clip.rendered.thumbnailUrl} alt={clip.title} className="w-full h-full object-cover" />
        ) : (
          <Play className="h-8 w-8" style={{ color: "var(--text-disabled)" }} />
        )}
        {isRendering && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{t("editor.applying")}</span>
          </div>
        )}
        {clip.status === "failed" && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="h-6 w-6" style={{ color: "var(--coral)" }} />
            <span className="text-xs" style={{ color: "var(--coral)" }}>{t("status.failed")}</span>
          </div>
        )}
        <div className="absolute bottom-2 right-2 text-[11px] font-medium px-2 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.7)" }}>
          {Math.round(clip.source.duration)}s
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-sm font-medium truncate mb-2">{clip.title}</h3>
        {clip.editConfig && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium" style={{ background: "var(--accent-glow)", color: "var(--accent)" }}>
              <TrendingUp className="h-3 w-3" />
              {clip.editConfig.captions.style}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          {isReady && (
            <>
              <Link href={`/editor/${clip.id}?project=${projectId}`} className="btn-accent flex-1 text-center text-xs py-2">{t("projects.card.edit")}</Link>
              {clip.rendered?.videoUrl && (
                <a href={clip.rendered.videoUrl} download className="btn-ghost flex items-center justify-center p-2">
                  <Download className="h-4 w-4" />
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
