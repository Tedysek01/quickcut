"use client";

import { useEffect, useState } from "react";
import { useAuthContext } from "@/lib/auth-context";
import { useTranslation } from "@/lib/i18n-context";
import { getProjects } from "@/lib/firestore";
import { Project } from "@/types/project";
import Link from "next/link";
import { Plus, Video } from "lucide-react";
import { StatusBadge } from "@/components/project/StatusBadge";

export default function ProjectsPage() {
  const { user } = useAuthContext();
  const { t } = useTranslation();
  const [projects, setProjects] = useState<(Project & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getProjects(user.uid).then((data) => {
      setProjects(data);
      setLoading(false);
    });
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-syne)" }}
        >
          {t("projects.title")}
        </h1>
        <Link href="/projects/new" className="btn-accent flex items-center gap-2 text-sm px-4 py-2.5">
          <Plus className="h-4 w-4" />
          {t("projects.new")}
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "var(--bg-card)" }}
          >
            <Video className="h-8 w-8" style={{ color: "var(--text-disabled)" }} />
          </div>
          <h2
            className="text-lg font-semibold mb-2"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            {t("projects.empty.title")}
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
            {t("projects.empty.sub")}
          </p>
          <Link href="/projects/new" className="btn-accent inline-flex items-center gap-2 text-sm px-6 py-3">
            <Plus className="h-4 w-4" />
            {t("projects.empty.cta")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project, i) => (
            <Link
              key={project.id}
              href={`/project/${project.id}`}
              className="card card-interactive p-4 opacity-0 animate-fade-in"
              style={{ animationDelay: `${i * 0.05}s`, animationFillMode: "forwards" }}
            >
              <div
                className="aspect-video rounded-lg mb-3 flex items-center justify-center"
                style={{ background: "var(--bg-elevated)" }}
              >
                <Video className="h-8 w-8" style={{ color: "var(--text-disabled)" }} />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm truncate flex-1">{project.title}</h3>
                <StatusBadge status={project.status} />
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {project.format.replace("_", " ")} &middot;{" "}
                {project.rawVideo?.duration ? `${Math.round(project.rawVideo.duration)}s` : "Processing..."}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
