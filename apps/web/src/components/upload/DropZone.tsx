"use client";

import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Film, X, GripVertical } from "lucide-react";
import { useTranslation } from "@/lib/i18n-context";

const ACCEPTED_TYPES = {
  "video/mp4": [".mp4"],
  "video/quicktime": [".mov"],
  "video/webm": [".webm"],
};

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  maxSizeMB: number;
  selectedFiles: File[];
}

export default function DropZone({ onFilesSelected, maxSizeMB, selectedFiles }: DropZoneProps) {
  const { t } = useTranslation();
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragCounterRef = useRef(0);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFilesSelected([...selectedFiles, ...acceptedFiles]);
      }
    },
    [onFilesSelected, selectedFiles]
  );

  const removeFile = (index: number) => {
    onFilesSelected(selectedFiles.filter((_, i) => i !== index));
  };

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop, accept: ACCEPTED_TYPES, maxSize: maxSizeMB * 1024 * 1024, maxFiles: 10, multiple: true,
  });

  const sizeError = fileRejections.find((r) => r.errors.some((e) => e.code === "file-too-large"));
  const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);

  // Drag-to-reorder handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIdx(index);
    e.dataTransfer.effectAllowed = "move";
    // Make the drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 20, 20);
    }
  };

  const handleDragEnter = (index: number) => {
    dragCounterRef.current++;
    if (dragIdx !== null && dragIdx !== index) {
      setOverIdx(index);
    }
  };

  const handleDragLeave = () => {
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setOverIdx(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    if (dragIdx === null || dragIdx === targetIndex) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    const reordered = [...selectedFiles];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(targetIndex, 0, moved);
    onFilesSelected(reordered);
    setDragIdx(null);
    setOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
    dragCounterRef.current = 0;
  };

  return (
    <div>
      <div
        {...getRootProps()}
        className="rounded-2xl p-8 text-center cursor-pointer transition-all duration-200"
        style={{
          border: `2px dashed ${isDragActive ? "var(--accent)" : selectedFiles.length ? "var(--status-done)" : "var(--border)"}`,
          background: isDragActive ? "var(--accent-glow)" : selectedFiles.length ? "rgba(52, 211, 153, 0.05)" : "var(--bg-card)",
        }}
      >
        <input {...getInputProps()} />
        {selectedFiles.length === 0 ? (
          <div className="py-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--bg-elevated)" }}>
              <Upload className="h-7 w-7" style={{ color: "var(--text-muted)" }} />
            </div>
            <p className="text-sm font-medium mb-1">{t("upload.dropzone.title")}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("upload.dropzone.or")} &middot; {t("upload.dropzone.formats")}</p>
            <p className="text-xs mt-2" style={{ color: "var(--text-disabled)" }}>
              Upload multiple videos to stitch them together
            </p>
          </div>
        ) : (
          <div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "rgba(52, 211, 153, 0.1)" }}>
              <Upload className="h-5 w-5" style={{ color: "var(--text-muted)" }} />
            </div>
            <p className="text-xs" style={{ color: "var(--text-disabled)" }}>
              Drop more videos to add them
            </p>
          </div>
        )}
      </div>

      {/* File list with drag-to-reorder */}
      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {selectedFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150"
              style={{
                background: dragIdx === index
                  ? "var(--bg-elevated)"
                  : "var(--bg-card)",
                border: overIdx === index
                  ? "1px solid var(--accent)"
                  : "1px solid var(--border)",
                opacity: dragIdx === index ? 0.5 : 1,
                transform: overIdx === index ? "scale(1.02)" : "scale(1)",
              }}
            >
              <GripVertical
                className="h-4 w-4 flex-shrink-0 cursor-grab active:cursor-grabbing"
                style={{ color: "var(--text-disabled)" }}
              />
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(52, 211, 153, 0.1)" }}>
                <Film className="h-4 w-4" style={{ color: "var(--status-done)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "var(--bg-elevated)", color: "var(--text-disabled)" }}>
                {index + 1}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                className="p-1 rounded-lg transition-colors hover:bg-white/5 cursor-pointer"
                style={{ color: "var(--text-muted)" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between px-1 pt-1">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {selectedFiles.length} {selectedFiles.length === 1 ? "video" : "videos"} &middot; {(totalSize / (1024 * 1024)).toFixed(1)} MB total
            </p>
            {selectedFiles.length > 1 && (
              <p className="text-xs" style={{ color: "var(--accent)" }}>
                Drag to reorder &middot; stitched in order
              </p>
            )}
          </div>
        </div>
      )}

      {sizeError && <p className="text-sm mt-2 px-1" style={{ color: "var(--coral)" }}>File is too large. Maximum size is {maxSizeMB}MB.</p>}
    </div>
  );
}
