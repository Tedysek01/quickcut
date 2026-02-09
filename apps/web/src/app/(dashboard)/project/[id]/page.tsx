"use client";

import { use } from "react";
import { useAuthContext } from "@/lib/auth-context";
import { useTranslation } from "@/lib/i18n-context";
import { useProject } from "@/lib/hooks/useProject";
import { useClips } from "@/lib/hooks/useClips";
import { StatusBadge } from "@/components/project/StatusBadge";
import { PipelineStepper } from "@/components/project/PipelineStepper";
import ClipCard from "@/components/project/ClipCard";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const { user } = useAuthContext();
  const { t } = useTranslation();
  const { project, loading: projectLoading } = useProject(user?.uid, projectId);
  const { clips, loading: clipsLoading } = useClips(user?.uid, projectId);

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!project) {
    return <div className="text-center py-20"><p style={{ color: "var(--text-muted)" }}>Project not found.</p></div>;
  }

  const isProcessing = ["uploading", "uploaded", "transcribing", "analyzing", "rendering"].includes(project.status);

  return (
    <div>
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-colors" style={{ color: "var(--text-muted)" }}>
        <ArrowLeft className="h-4 w-4" /> {t("projectDetail.back")}
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-syne)" }}>{project.title}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {project.format.replace("_", " ")}{project.rawVideo?.duration ? ` \u00B7 ${Math.round(project.rawVideo.duration)}s` : ""}
          </p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      {isProcessing && (
        <PipelineStepper
          status={project.status}
          startedAt={project.processing?.startedAt}
          clipsDone={clips.filter((c) => c.status === "done").length}
          clipsTotal={clips.length}
        />
      )}

      {project.status === "failed" && (
        <div className="rounded-2xl p-10 text-center" style={{ background: "rgba(255, 71, 87, 0.05)", border: "1px solid rgba(255, 71, 87, 0.15)" }}>
          <AlertCircle className="h-10 w-10 mx-auto mb-4" style={{ color: "var(--coral)" }} />
          <h2 className="text-lg font-semibold mb-2">{t("projectDetail.failed.title")}</h2>
          <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>{project.failReason || t("projectDetail.failed.sub")}</p>
          <button className="btn-ghost inline-flex items-center gap-2 text-sm px-4 py-2 cursor-pointer">
            <RefreshCw className="h-4 w-4" /> {t("projectDetail.failed.retry")}
          </button>
        </div>
      )}

      {project.status === "done" && (
        <div>
          {project.rawVideo?.storageUrl && (
            <div className="mb-8">
              <details className="group">
                <summary className="text-sm cursor-pointer transition-colors" style={{ color: "var(--text-muted)" }}>Show original video</summary>
                <div className="mt-3"><video src={project.rawVideo.storageUrl} controls className="w-full max-w-2xl rounded-xl" /></div>
              </details>
            </div>
          )}
          {clipsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
            </div>
          ) : clips.length === 0 ? (
            <p className="text-center py-8" style={{ color: "var(--text-muted)" }}>No clips generated yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clips.map((clip) => <ClipCard key={clip.id} clip={clip} projectId={projectId} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
