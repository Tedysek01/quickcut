"use client";

import { Upload } from "lucide-react";
import { useTranslation } from "@/lib/i18n-context";

export default function UploadProgress({ progress, fileName }: { progress: number; fileName: string }) {
  const { t } = useTranslation();

  return (
    <div className="card p-8">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center animate-pulse-glow" style={{ background: "var(--accent)" }}>
          <Upload className="h-5 w-5" style={{ color: "var(--accent-text)" }} />
        </div>
        <div>
          <p className="text-sm font-medium">{t("upload.progress.uploading")}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{fileName}</p>
        </div>
      </div>
      <div className="progress-bar h-2 rounded">
        <div className="progress-bar-fill h-2 rounded" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-xs mt-3 text-right font-medium" style={{ color: "var(--accent)" }}>{Math.round(progress)}%</p>
    </div>
  );
}
