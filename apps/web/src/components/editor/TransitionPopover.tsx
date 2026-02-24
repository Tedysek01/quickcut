"use client";

import { useRef, useEffect } from "react";
import type { SegmentTransition } from "@/types/editConfig";
import { useEditorStore } from "@/stores/editorStore";

interface TransitionPopoverProps {
  segmentId: string;
  currentTransition: SegmentTransition;
  currentDuration: number;
  position: { x: number; y: number };
  onClose: () => void;
}

const TRANSITIONS: { value: SegmentTransition; label: string }[] = [
  { value: "none", label: "None" },
  { value: "hard", label: "Hard" },
  { value: "crossfade", label: "Crossfade" },
  { value: "fade", label: "Fade" },
  { value: "wipe_left", label: "Wipe L" },
  { value: "wipe_right", label: "Wipe R" },
  { value: "slide_up", label: "Slide Up" },
  { value: "dissolve", label: "Dissolve" },
  { value: "zoom_in", label: "Zoom In" },
  { value: "circle", label: "Circle" },
];

/**
 * Popover for selecting transition type and duration between segments.
 * Positioned absolutely relative to the timeline diamond marker.
 * Closes on click-outside or Escape.
 */
export default function TransitionPopover({
  segmentId,
  currentTransition,
  currentDuration,
  position,
  onClose,
}: TransitionPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { updateEditConfig, editConfig } = useEditorStore();

  const setTransition = (transition: SegmentTransition) => {
    if (!editConfig) return;
    const segments = editConfig.segments.map((s) =>
      s.id === segmentId ? { ...s, transition } : s
    );
    updateEditConfig({ segments });
  };

  const setDuration = (duration: number) => {
    if (!editConfig) return;
    const segments = editConfig.segments.map((s) =>
      s.id === segmentId ? { ...s, transitionDuration: duration } : s
    );
    updateEditConfig({ segments });
  };

  // Close on click-outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const showDuration =
    currentTransition !== "none" && currentTransition !== "hard";

  return (
    <div
      ref={ref}
      className="absolute z-50 rounded-lg shadow-xl p-3 space-y-3"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        minWidth: "200px",
      }}
    >
      <div
        className="text-[10px] uppercase tracking-wider"
        style={{ color: "var(--text-disabled)" }}
      >
        Transition
      </div>

      {/* Transition type pills */}
      <div className="flex flex-wrap gap-1">
        {TRANSITIONS.map((t) => {
          const isActive = currentTransition === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setTransition(t.value)}
              className="px-2 py-1 rounded text-[10px] font-medium transition-all"
              style={{
                background: isActive ? "var(--accent)" : "var(--bg-elevated)",
                color: isActive ? "#000" : "var(--text-secondary)",
                border: isActive
                  ? "1px solid var(--accent)"
                  : "1px solid var(--border-subtle)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Duration slider — only for non-trivial transitions */}
      {showDuration && (
        <div>
          <label
            className="text-[10px] uppercase tracking-wider block mb-1"
            style={{ color: "var(--text-disabled)" }}
          >
            Duration
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0.1}
              max={1.5}
              step={0.05}
              value={currentDuration}
              onChange={(e) => setDuration(parseFloat(e.target.value))}
              className="flex-1 accent-[var(--accent)]"
            />
            <span
              className="text-xs font-mono tabular-nums w-10 text-right"
              style={{ color: "var(--text-secondary)" }}
            >
              {currentDuration.toFixed(1)}s
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
