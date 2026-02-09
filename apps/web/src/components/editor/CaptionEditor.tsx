"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useEditorStore } from "@/stores/editorStore";
import type { Word } from "@/types/project";
import { Eye, EyeOff, Highlighter, Type } from "lucide-react";

/**
 * Inline caption/transcript editor.
 *
 * Shows transcript words in a flow layout. Users can:
 * - Click a word to select it
 * - Edit the text of a word (caption override)
 * - Toggle highlight on a word
 * - Hide a word from captions
 * - See which words are currently being spoken (synced to playback)
 */

export default function CaptionEditor() {
  const {
    transcript,
    clipStart,
    clipEnd,
    editConfig,
    currentTime,
    updateCaptionText,
    toggleWordHighlight,
    hideWord,
  } = useEditorStore();

  const [editingWordIndex, setEditingWordIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter words within clip range, with clip-relative times
  const clipWords = useMemo(() => {
    if (!transcript.length) return [];
    return transcript
      .map((w, originalIndex) => ({
        ...w,
        originalIndex,
        relativeStart: w.start - clipStart,
        relativeEnd: w.end - clipStart,
      }))
      .filter((w) => w.start >= clipStart && w.end <= clipEnd);
  }, [transcript, clipStart, clipEnd]);

  // Find the currently spoken word (nearest to playback position)
  // currentTime is in output time, we need to figure out which source word it maps to
  // For simplicity, we'll highlight based on output time matching
  const activeWordIndex = useMemo(() => {
    if (!clipWords.length || !editConfig?.segments) return -1;

    // Convert output time to source time by walking segments
    let sourceTime = 0;
    let remainingOutputTime = currentTime;
    for (const seg of editConfig.segments) {
      const segDuration = seg.sourceEnd - seg.sourceStart;
      if (remainingOutputTime <= segDuration) {
        sourceTime = seg.sourceStart + remainingOutputTime;
        break;
      }
      remainingOutputTime -= segDuration;
      sourceTime = seg.sourceEnd;
    }

    // Find word closest to this source time (clip-relative)
    for (let i = 0; i < clipWords.length; i++) {
      const w = clipWords[i];
      if (currentTime >= w.relativeStart - 0.05 && currentTime <= w.relativeEnd + 0.05) {
        return w.originalIndex;
      }
    }
    return -1;
  }, [clipWords, currentTime, editConfig?.segments]);

  // Start editing a word
  const startEditing = useCallback(
    (wordIndex: number, currentText: string) => {
      setEditingWordIndex(wordIndex);
      setEditText(currentText);
    },
    []
  );

  // Commit edit
  const commitEdit = useCallback(() => {
    if (editingWordIndex !== null && editText.trim()) {
      // Only save if text actually changed
      const original = transcript[editingWordIndex]?.word || "";
      const override = editConfig?.captionOverrides?.[editingWordIndex];
      const currentOverrideText = override?.text ?? original;
      if (editText.trim() !== currentOverrideText) {
        updateCaptionText(editingWordIndex, editText.trim());
      }
    }
    setEditingWordIndex(null);
    setEditText("");
  }, [editingWordIndex, editText, transcript, editConfig?.captionOverrides, updateCaptionText]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingWordIndex !== null && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingWordIndex]);

  if (!clipWords.length) {
    return (
      <div className="text-center py-4">
        <p className="text-xs" style={{ color: "var(--text-disabled)" }}>
          No transcript available
        </p>
      </div>
    );
  }

  const overrides = editConfig?.captionOverrides || {};

  return (
    <div>
      <h3
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: "var(--text-muted)" }}
      >
        <Type className="h-3 w-3 inline mr-1" />
        Transcript
      </h3>

      <div
        ref={containerRef}
        className="flex flex-wrap gap-0.5 max-h-[200px] overflow-y-auto p-2 rounded-lg"
        style={{ background: "var(--bg-elevated)" }}
      >
        {clipWords.map((word) => {
          const idx = word.originalIndex;
          const override = overrides[idx];
          const isHidden = override?.hidden;
          const isHighlighted = override?.highlight;
          const displayText = override?.text ?? word.word;
          const isActive = idx === activeWordIndex;
          const isEditing = editingWordIndex === idx;

          if (isEditing) {
            return (
              <input
                key={idx}
                ref={editInputRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") {
                    setEditingWordIndex(null);
                    setEditText("");
                  }
                }}
                className="text-xs px-1 py-0.5 rounded border outline-none"
                style={{
                  borderColor: "var(--accent)",
                  background: "var(--bg-card)",
                  color: "var(--text-primary)",
                  width: `${Math.max(displayText.length * 8, 40)}px`,
                }}
              />
            );
          }

          return (
            <span
              key={idx}
              className="group relative inline-flex items-center cursor-pointer rounded px-0.5 py-0.5 text-xs transition-all select-none"
              style={{
                color: isHidden
                  ? "var(--text-disabled)"
                  : isHighlighted
                  ? editConfig?.captions.highlightColor || "var(--accent)"
                  : isActive
                  ? "var(--accent)"
                  : "var(--text-secondary)",
                textDecoration: isHidden ? "line-through" : "none",
                background: isActive ? "rgba(var(--accent-rgb, 59, 130, 246), 0.1)" : "transparent",
                fontWeight: isActive || isHighlighted ? 600 : 400,
                opacity: isHidden ? 0.4 : 1,
              }}
              onDoubleClick={() => startEditing(idx, displayText)}
              title="Double-click to edit"
            >
              {displayText}

              {/* Hover action buttons */}
              <span className="hidden group-hover:inline-flex items-center gap-0.5 ml-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleWordHighlight(idx);
                  }}
                  className="p-0.5 rounded transition-colors"
                  style={{
                    color: isHighlighted ? "var(--accent)" : "var(--text-disabled)",
                  }}
                  title="Toggle highlight"
                >
                  <Highlighter className="h-2.5 w-2.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    hideWord(idx);
                  }}
                  className="p-0.5 rounded transition-colors"
                  style={{
                    color: isHidden ? "var(--accent)" : "var(--text-disabled)",
                  }}
                  title={isHidden ? "Show word" : "Hide word"}
                >
                  {isHidden ? (
                    <Eye className="h-2.5 w-2.5" />
                  ) : (
                    <EyeOff className="h-2.5 w-2.5" />
                  )}
                </button>
              </span>
            </span>
          );
        })}
      </div>

      <p className="text-[10px] mt-1.5" style={{ color: "var(--text-disabled)" }}>
        Double-click a word to edit. Hover for highlight/hide controls.
      </p>
    </div>
  );
}
