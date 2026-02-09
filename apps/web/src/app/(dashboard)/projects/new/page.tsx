"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/lib/auth-context";
import { useTranslation } from "@/lib/i18n-context";
import { useUsage } from "@/lib/hooks/useUsage";
import { createProject, updateProject } from "@/lib/firestore";
import { uploadVideo, uploadSourceVideo } from "@/lib/storage";
import { VideoFormat, VideoLanguage, SourceVideo } from "@/types/project";
import DropZone from "@/components/upload/DropZone";
import FormatSelector from "@/components/upload/FormatSelector";
import LanguageSelector from "@/components/upload/LanguageSelector";
import { ArrowLeft, Zap, ArrowRight, Upload, Check, Film } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface FileUploadState {
  name: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
}

export default function NewProjectPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { t } = useTranslation();
  const { isAtLimit, limits } = useUsage(user?.uid);

  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<VideoFormat>("talking_head");
  const [language, setLanguage] = useState<VideoLanguage>("cs");
  const [uploading, setUploading] = useState(false);
  const [fileStates, setFileStates] = useState<FileUploadState[]>([]);

  const handleUpload = async () => {
    if (!files.length || !user) return;
    try {
      setUploading(true);

      // Initialize per-file progress states
      const initialStates: FileUploadState[] = files.map((f) => ({
        name: f.name,
        progress: 0,
        status: "pending",
      }));
      setFileStates(initialStates);

      // Create project
      const projectId = await createProject(user.uid, {
        format,
        language,
        rawVideo: { storageUrl: "", duration: 0, resolution: { width: 0, height: 0 }, fileSize: 0, fps: 0 },
      } as Partial<import("@/types/project").Project>);

      if (files.length === 1) {
        // Single file: use the original upload path
        setFileStates((prev) => prev.map((s, i) => i === 0 ? { ...s, status: "uploading" } : s));

        const downloadUrl = await uploadVideo(user.uid, projectId, files[0], (progress) => {
          setFileStates((prev) => prev.map((s, i) => i === 0 ? { ...s, progress } : s));
        });

        setFileStates((prev) => prev.map((s, i) => i === 0 ? { ...s, progress: 100, status: "done" } : s));

        await updateProject(user.uid, projectId, {
          status: "uploaded",
          "rawVideo.storageUrl": downloadUrl,
          "rawVideo.fileSize": files[0].size,
          sourceVideos: [{
            id: "src_0",
            originalName: files[0].name,
            storageUrl: downloadUrl,
            duration: 0,
            fileSize: files[0].size,
            order: 0,
            offsetInTimeline: 0,
          }],
        });
      } else {
        // Multi-file: upload each source video sequentially
        const sourceVideos: SourceVideo[] = [];

        for (let i = 0; i < files.length; i++) {
          setFileStates((prev) => prev.map((s, idx) => idx === i ? { ...s, status: "uploading" } : s));

          const downloadUrl = await uploadSourceVideo(user.uid, projectId, files[i], i, (progress) => {
            setFileStates((prev) => prev.map((s, idx) => idx === i ? { ...s, progress } : s));
          });

          setFileStates((prev) => prev.map((s, idx) => idx === i ? { ...s, progress: 100, status: "done" } : s));

          sourceVideos.push({
            id: `src_${i}`,
            originalName: files[i].name,
            storageUrl: downloadUrl,
            duration: 0,
            fileSize: files[i].size,
            order: i,
            offsetInTimeline: 0,
          });
        }

        // For multi-video, rawVideo.storageUrl points to first source until server concat replaces it
        await updateProject(user.uid, projectId, {
          status: "uploaded",
          "rawVideo.storageUrl": sourceVideos[0].storageUrl,
          "rawVideo.fileSize": files.reduce((sum, f) => sum + f.size, 0),
          sourceVideos,
        });
      }

      toast.success(files.length > 1
        ? `${files.length} videos uploaded! Stitching and processing...`
        : "Video uploaded successfully!"
      );
      router.push(`/project/${projectId}`);
    } catch (err) {
      console.error("Upload failed:", err);
      toast.error("Upload failed. Please try again.");
      setUploading(false);
    }
  };

  if (isAtLimit) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(245, 158, 11, 0.1)" }}>
          <Zap className="h-8 w-8" style={{ color: "var(--status-transcribing)" }} />
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "var(--font-syne)" }}>{t("newProject.limitReached")}</h2>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>{t("newProject.limitMessage")}</p>
        <Link href="/pricing" className="btn-accent inline-flex items-center gap-2 text-sm px-6 py-3">{t("newProject.viewPlans")}</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-colors" style={{ color: "var(--text-muted)" }}>
        <ArrowLeft className="h-4 w-4" />
        {t("newProject.back")}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight mb-2" style={{ fontFamily: "var(--font-syne)" }}>{t("newProject.title")}</h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>{t("newProject.sub")}</p>
      {uploading ? (
        <MultiUploadProgress fileStates={fileStates} />
      ) : (
        <div className="space-y-8">
          <DropZone onFilesSelected={setFiles} maxSizeMB={limits.maxFileSizeMB} selectedFiles={files} />
          <FormatSelector selected={format} onChange={setFormat} />
          <LanguageSelector selected={language} onChange={setLanguage} />
          <button onClick={handleUpload} disabled={!files.length} className="btn-accent w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-30 cursor-pointer">
            {t("newProject.continue")} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Per-file upload progress display */
function MultiUploadProgress({ fileStates }: { fileStates: FileUploadState[] }) {
  const totalProgress = fileStates.length > 0
    ? fileStates.reduce((sum, f) => sum + f.progress, 0) / fileStates.length
    : 0;

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-4 mb-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center animate-pulse-glow" style={{ background: "var(--accent)" }}>
          <Upload className="h-5 w-5" style={{ color: "var(--accent-text)" }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">
            Uploading {fileStates.length} {fileStates.length === 1 ? "video" : "videos"}...
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {Math.round(totalProgress)}% complete
          </p>
        </div>
      </div>
      <div className="progress-bar h-2 rounded">
        <div className="progress-bar-fill h-2 rounded transition-all duration-300" style={{ width: `${totalProgress}%` }} />
      </div>

      <div className="space-y-2 pt-2">
        {fileStates.map((file, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{
              background: file.status === "done" ? "rgba(52, 211, 153, 0.1)" : file.status === "uploading" ? "var(--accent-glow)" : "var(--bg-elevated)",
            }}>
              {file.status === "done" ? (
                <Check className="h-3.5 w-3.5" style={{ color: "var(--status-done)" }} />
              ) : (
                <Film className="h-3.5 w-3.5" style={{ color: file.status === "uploading" ? "var(--accent)" : "var(--text-disabled)" }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs truncate" style={{ color: file.status === "done" ? "var(--status-done)" : "var(--text-secondary)" }}>
                {file.name}
              </p>
            </div>
            <span className="text-xs font-mono flex-shrink-0" style={{
              color: file.status === "done" ? "var(--status-done)" : file.status === "uploading" ? "var(--accent)" : "var(--text-disabled)",
            }}>
              {file.status === "done" ? "Done" : file.status === "uploading" ? `${Math.round(file.progress)}%` : "Waiting"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
