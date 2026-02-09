"use client";

import { use, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthContext } from "@/lib/auth-context";
import { useTranslation } from "@/lib/i18n-context";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { updateClip, updateUser, triggerRerender } from "@/lib/firestore";
import { Clip } from "@/types/clip";
import { Project } from "@/types/project";
import VideoPreview from "@/components/editor/VideoPreview";
import PropertiesPanel from "@/components/editor/PropertiesPanel";
import Timeline from "@/components/editor/Timeline";
import ExportModal from "@/components/editor/ExportModal";
import type { ExportSettings } from "@/components/editor/ExportModal";
import { useEditorStore } from "@/stores/editorStore";
import {
  ArrowLeft,
  Download,
  Upload,
  Undo2,
  Redo2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function EditorPage({
  params,
}: {
  params: Promise<{ clipId: string }>;
}) {
  const { clipId } = use(params);
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project") || "";
  const { user } = useAuthContext();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [sourceVideoUrl, setSourceVideoUrl] = useState<string | null>(null);
  const [proxyVideoUrl, setProxyVideoUrl] = useState<string | null>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  // J/K/L shuttle speed: -2, -1, 0, 1, 2
  const shuttleSpeedRef = useRef(0);

  const {
    clip,
    editConfig,
    isDirty,
    isSaving,
    initialize,
    undo,
    redo,
    editHistory,
    editFuture,
    markSaved,
    markSaving,
    useProxy,
    proxyVideoUrl: storeProxyUrl,
    toggleProxy,
  } = useEditorStore();

  // Load clip + project data
  useEffect(() => {
    if (!user || !projectId) return;

    const clipRef = doc(
      db,
      "users",
      user.uid,
      "projects",
      projectId,
      "clips",
      clipId
    );

    const unsubscribe = onSnapshot(clipRef, async (snap) => {
      if (!snap.exists()) {
        setLoading(false);
        return;
      }

      const clipData = snap.data() as Clip;

      // If store isn't initialized yet, load full data
      if (!useEditorStore.getState().clip) {
        // Fetch project data for transcript
        const projectRef = doc(db, "users", user.uid, "projects", projectId);
        const projectSnap = await getDoc(projectRef);
        const projectData = projectSnap.data() as Project;

        // Get source video URL for NLE preview
        let resolvedSourceUrl: string | null = null;
        if (projectData?.rawVideo?.storageUrl) {
          try {
            const storageUrl = projectData.rawVideo.storageUrl;
            let path: string;
            if (storageUrl.startsWith("gs://")) {
              path = storageUrl.split("/").slice(3).join("/");
            } else {
              path = storageUrl;
            }
            const videoRef = ref(storage, path);
            resolvedSourceUrl = await getDownloadURL(videoRef);
            setSourceVideoUrl(resolvedSourceUrl);
          } catch (err) {
            console.warn("Could not load source video for NLE preview:", err);
          }
        }

        // Get proxy video URL if available
        let resolvedProxyUrl: string | null = null;
        if (projectData?.proxyUrl) {
          try {
            const proxyPath = projectData.proxyUrl;
            let path: string;
            if (proxyPath.startsWith("gs://")) {
              path = proxyPath.split("/").slice(3).join("/");
            } else {
              path = proxyPath;
            }
            const proxyRef = ref(storage, path);
            resolvedProxyUrl = await getDownloadURL(proxyRef);
            setProxyVideoUrl(resolvedProxyUrl);
          } catch (err) {
            console.warn("Could not load proxy video:", err);
          }
        }

        initialize({
          clip: clipData,
          project: projectData,
          sourceVideoUrl: resolvedSourceUrl || "",
          proxyVideoUrl: resolvedProxyUrl,
          sourceVideos: projectData?.sourceVideos || [],
          transcript: projectData?.transcript?.words || [],
          clipStart: clipData.source.startTime,
          clipEnd: clipData.source.endTime,
        });
      }

      // Update clip status if rendering finished
      if (clipData.status === "done" && exporting) {
        setExporting(false);
        toast.success(t("editor.rerendered"));
      }

      setLoading(false);
    });

    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, projectId, clipId]);

  // Auto-save editConfig to Firestore (debounced 2s)
  useEffect(() => {
    if (!isDirty || !user || !projectId || !editConfig) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      try {
        markSaving();
        await updateClip(user.uid, projectId, clipId, { editConfig });
        markSaved();
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    }, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [isDirty, editConfig, user, projectId, clipId, markSaved, markSaving]);

  // beforeunload warning for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useEditorStore.getState().isDirty) {
        e.preventDefault();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Keyboard shortcuts: Cmd+Z, Cmd+Shift+Z, Space, Escape, S, J/K/L, Arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (e.key === " ") {
        e.preventDefault();
        shuttleSpeedRef.current = 0;
        window.dispatchEvent(new CustomEvent("editor:toggle-play"));
      } else if (e.key === "Escape") {
        useEditorStore.getState().selectElement(null);
      } else if (e.key === "s" && !e.metaKey && !e.ctrlKey) {
        // Split at playhead
        e.preventDefault();
        const store = useEditorStore.getState();
        if (store.editConfig?.segments) {
          let outputOffset = 0;
          for (const seg of store.editConfig.segments) {
            const duration = seg.sourceEnd - seg.sourceStart;
            if (
              store.currentTime >= outputOffset &&
              store.currentTime <= outputOffset + duration
            ) {
              const splitSourceTime =
                seg.sourceStart + (store.currentTime - outputOffset);
              store.splitSegment(seg.id, splitSourceTime);
              return;
            }
            outputOffset += duration;
          }
        }
      } else if (e.key === "j" || e.key === "J") {
        // J = reverse / slower shuttle
        e.preventDefault();
        shuttleSpeedRef.current = Math.max(shuttleSpeedRef.current - 1, -2);
        window.dispatchEvent(
          new CustomEvent("editor:shuttle", {
            detail: { speed: shuttleSpeedRef.current },
          })
        );
      } else if (e.key === "k" || e.key === "K") {
        // K = stop/pause
        e.preventDefault();
        shuttleSpeedRef.current = 0;
        window.dispatchEvent(
          new CustomEvent("editor:shuttle", { detail: { speed: 0 } })
        );
      } else if (e.key === "l" || e.key === "L") {
        // L = forward / faster shuttle
        e.preventDefault();
        shuttleSpeedRef.current = Math.min(shuttleSpeedRef.current + 1, 2);
        window.dispatchEvent(
          new CustomEvent("editor:shuttle", {
            detail: { speed: shuttleSpeedRef.current },
          })
        );
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        // Shift+Left = back 1 second, Left = back 1 frame (~33ms at 30fps)
        const step = e.shiftKey ? -1 : -1 / 30;
        window.dispatchEvent(
          new CustomEvent("editor:step", { detail: { seconds: step } })
        );
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        // Shift+Right = forward 1 second, Right = forward 1 frame
        const step = e.shiftKey ? 1 : 1 / 30;
        window.dispatchEvent(
          new CustomEvent("editor:step", { detail: { seconds: step } })
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  // Export (final render) - calls Cloud Function to trigger Modal pipeline
  const handleExport = useCallback(async (settings?: ExportSettings) => {
    if (!user || !editConfig || !projectId) return;
    try {
      setExporting(true);
      setExportModalOpen(true);

      // Call Cloud Function which saves editConfig + triggers Modal rerender
      await triggerRerender(projectId, clipId, editConfig, settings);

      // Save user preferences
      if (editConfig.captions.style) {
        await updateUser(user.uid, {
          "preferences.defaultCaptionStyle": editConfig.captions.style,
        });
      }

      toast.info("Exporting video...");
    } catch (err) {
      console.error("Failed to start export:", err);
      toast.error("Export failed");
      setExporting(false);
    }
  }, [user, editConfig, projectId, clipId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{
            borderColor: "var(--accent)",
            borderTopColor: "transparent",
          }}
        />
      </div>
    );
  }

  if (!clip || !editConfig) {
    return (
      <div className="text-center py-20">
        <p style={{ color: "var(--text-muted)" }}>{t("editor.notFound")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-2">
      {/* Top toolbar */}
      <div
        className="flex items-center justify-between px-4 py-1.5 rounded-lg"
        style={{ background: "var(--bg-card)" }}
      >
        <div className="flex items-center gap-3">
          <Link
            href={`/project/${projectId}`}
            className="inline-flex items-center gap-1 text-sm transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1
            className="text-sm font-semibold truncate max-w-[200px]"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            {clip.title}
          </h1>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!editHistory.length}
            className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--bg-elevated)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
            title="Undo (Cmd+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={redo}
            disabled={!editFuture.length}
            className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--bg-elevated)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
            title="Redo (Cmd+Shift+Z)"
          >
            <Redo2 className="h-4 w-4" />
          </button>

          <div className="w-px h-5 mx-1" style={{ background: "var(--border)" }} />

          {/* Proxy toggle */}
          {storeProxyUrl && (
            <button
              onClick={toggleProxy}
              className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors cursor-pointer"
              style={{
                background: useProxy ? "rgba(191, 255, 10, 0.1)" : "var(--bg-elevated)",
                color: useProxy ? "var(--accent)" : "var(--text-disabled)",
                border: `1px solid ${useProxy ? "rgba(191, 255, 10, 0.2)" : "var(--border)"}`,
              }}
              title={useProxy ? "Using 480p proxy — click for full quality" : "Using full quality — click for proxy"}
            >
              {useProxy ? "480p" : "Full"}
            </button>
          )}

          {/* Save indicator */}
          <span className="text-[10px] px-2" style={{ color: "var(--text-disabled)" }}>
            {isSaving ? "Saving..." : isDirty ? "Unsaved" : "Saved"}
          </span>

          <div className="w-px h-5 mx-1" style={{ background: "var(--border)" }} />

          {clip.rendered?.videoUrl && (
            <a
              href={clip.rendered.videoUrl}
              download
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--bg-elevated)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          )}

          <button
            onClick={() => setExportModalOpen(true)}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            style={{
              background: "var(--accent)",
              color: "#000",
            }}
          >
            <Upload className="h-3.5 w-3.5" />
            {exporting ? "Exporting..." : "Export"}
          </button>
        </div>
      </div>

      {/* Main content: Preview + Properties */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-2 min-h-0">
        <div className="lg:col-span-3 overflow-auto">
          <VideoPreview
            sourceUrl={useProxy && proxyVideoUrl ? proxyVideoUrl : sourceVideoUrl}
            renderedUrl={clip.rendered?.videoUrl}
            poster={clip.rendered?.thumbnailUrl}
          />
        </div>
        <div className="lg:col-span-2 overflow-auto">
          <PropertiesPanel
            config={editConfig}
            onChange={(newConfig) =>
              useEditorStore.getState().updateEditConfig(newConfig)
            }
            onApply={() => handleExport()}
            applying={exporting}
          />
        </div>
      </div>

      {/* Timeline at bottom */}
      <div className="flex-shrink-0">
        <Timeline />
      </div>

      {/* Export modal */}
      <ExportModal
        open={exportModalOpen}
        onClose={() => {
          setExportModalOpen(false);
          if (!exporting) setExporting(false);
        }}
        onExport={handleExport}
        clipStatus={
          exporting
            ? "rendering"
            : clip.status === "done" && exportModalOpen
            ? "done"
            : clip.status === "failed" && exportModalOpen
            ? "failed"
            : undefined
        }
      />
    </div>
  );
}
