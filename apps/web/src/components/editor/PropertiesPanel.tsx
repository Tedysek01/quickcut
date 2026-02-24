"use client";

import { useEditorStore } from "@/stores/editorStore";
import type { EditConfig, SegmentConfig, SegmentTransition, ZoomConfig, AnnotationConfig } from "@/types/editConfig";
import EditConfigPanel from "./EditConfigPanel";
import CaptionEditor from "./CaptionEditor";
import { Trash2, Clock, Zap, Move, ArrowRightLeft } from "lucide-react";

/**
 * Context-sensitive properties panel for the NLE editor.
 *
 * Shows different controls depending on what's selected:
 * - Segment selected: trim range, duration, transition type
 * - Zoom selected: scale, duration, easing, anchor point
 * - Nothing selected: global EditConfigPanel + CaptionEditor
 */

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

// ---- Segment Properties ----

function SegmentProperties({ segment }: { segment: SegmentConfig }) {
  const { adjustSegmentEdge, deleteSegment, editConfig, clipEnd, clipStart, selectElement } =
    useEditorStore();
  const duration = segment.sourceEnd - segment.sourceStart;
  const canDelete = (editConfig?.segments.length || 0) > 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Segment
        </h3>
        {canDelete && (
          <button
            onClick={() => {
              deleteSegment(segment.id);
              selectElement(null);
            }}
            className="p-1 rounded transition-colors"
            style={{ color: "var(--error, #ef4444)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            title="Delete segment"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Time range */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: "var(--text-disabled)" }}>
            Start
          </label>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" style={{ color: "var(--text-muted)" }} />
            <input
              type="number"
              step={0.1}
              min={0}
              value={Number(segment.sourceStart.toFixed(2))}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) adjustSegmentEdge(segment.id, "start", val);
              }}
              className="input w-full text-xs font-mono tabular-nums"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: "var(--text-disabled)" }}>
            End
          </label>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" style={{ color: "var(--text-muted)" }} />
            <input
              type="number"
              step={0.1}
              min={segment.sourceStart + 0.1}
              value={Number(segment.sourceEnd.toFixed(2))}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) adjustSegmentEdge(segment.id, "end", val);
              }}
              className="input w-full text-xs font-mono tabular-nums"
            />
          </div>
        </div>
      </div>

      {/* Duration display */}
      <div
        className="text-xs px-2 py-1.5 rounded"
        style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
      >
        Duration: <span className="font-mono tabular-nums">{formatTime(duration)}</span>
      </div>

      {/* Transition type */}
      <div>
        <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: "var(--text-disabled)" }}>
          <ArrowRightLeft className="h-3 w-3 inline mr-1" />
          Transition In
        </label>
        <select
          value={segment.transition}
          onChange={(e) => {
            const { editConfig: cfg } = useEditorStore.getState();
            if (!cfg) return;
            const segments = cfg.segments.map((s) =>
              s.id === segment.id
                ? { ...s, transition: e.target.value as SegmentTransition }
                : s
            );
            useEditorStore.getState().updateEditConfig({ segments });
          }}
          className="input w-full text-xs"
        >
          <optgroup label="Basic">
            <option value="none">None</option>
            <option value="hard">Hard cut</option>
            <option value="crossfade">Crossfade</option>
            <option value="fade">Fade (black)</option>
          </optgroup>
          <optgroup label="Directional">
            <option value="wipe_left">Wipe left</option>
            <option value="wipe_right">Wipe right</option>
            <option value="slide_up">Slide up</option>
          </optgroup>
          <optgroup label="Effects">
            <option value="dissolve">Dissolve</option>
            <option value="zoom_in">Zoom in</option>
            <option value="circle">Circle open</option>
          </optgroup>
        </select>
      </div>

      {/* Transition duration — only shown for non-trivial transitions */}
      {segment.transition !== "none" && segment.transition !== "hard" && (
        <div>
          <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: "var(--text-disabled)" }}>
            Transition Duration
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0.1}
              max={1.5}
              step={0.05}
              value={segment.transitionDuration ?? 0.3}
              onChange={(e) => {
                const { editConfig: cfg } = useEditorStore.getState();
                if (!cfg) return;
                const segments = cfg.segments.map((s) =>
                  s.id === segment.id
                    ? { ...s, transitionDuration: parseFloat(e.target.value) }
                    : s
                );
                useEditorStore.getState().updateEditConfigDebounced({ segments });
              }}
              className="flex-1 accent-[var(--accent)]"
            />
            <span className="text-xs font-mono tabular-nums w-10 text-right" style={{ color: "var(--text-secondary)" }}>
              {(segment.transitionDuration ?? 0.3).toFixed(1)}s
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Zoom Properties ----

function ZoomProperties({ zoom }: { zoom: ZoomConfig }) {
  const { updateZoom, deleteZoom, selectElement, updateEditConfigDebounced, editConfig } = useEditorStore();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Zoom
        </h3>
        <button
          onClick={() => {
            deleteZoom(zoom.id);
            selectElement(null);
          }}
          className="p-1 rounded transition-colors"
          style={{ color: "var(--error, #ef4444)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          title="Delete zoom"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Scale */}
      <div>
        <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: "var(--text-disabled)" }}>
          <Zap className="h-3 w-3 inline mr-1" />
          Scale
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1.0}
            max={2.0}
            step={0.05}
            value={zoom.scale}
            onChange={(e) => {
              if (!editConfig) return;
              const zooms = editConfig.zooms.map((z) =>
                z.id === zoom.id ? { ...z, scale: parseFloat(e.target.value) } : z
              );
              updateEditConfigDebounced({ zooms });
            }}
            className="flex-1 accent-[var(--accent)]"
          />
          <span className="text-xs font-mono tabular-nums w-10 text-right" style={{ color: "var(--text-secondary)" }}>
            {zoom.scale.toFixed(2)}x
          </span>
        </div>
      </div>

      {/* Time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: "var(--text-disabled)" }}>
            Time
          </label>
          <input
            type="number"
            step={0.1}
            min={0}
            value={Number(zoom.time.toFixed(2))}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) updateZoom(zoom.id, { time: val });
            }}
            className="input w-full text-xs font-mono tabular-nums"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: "var(--text-disabled)" }}>
            Duration
          </label>
          <input
            type="number"
            step={0.1}
            min={0.1}
            max={5}
            value={Number(zoom.duration.toFixed(2))}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) updateZoom(zoom.id, { duration: val });
            }}
            className="input w-full text-xs font-mono tabular-nums"
          />
        </div>
      </div>

      {/* Easing */}
      <div>
        <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: "var(--text-disabled)" }}>
          Easing
        </label>
        <select
          value={zoom.easing}
          onChange={(e) =>
            updateZoom(zoom.id, { easing: e.target.value as ZoomConfig["easing"] })
          }
          className="input w-full text-xs"
        >
          <option value="ease_in_out">Ease In/Out</option>
          <option value="ease_in">Ease In</option>
          <option value="linear">Linear</option>
          <option value="snap">Snap</option>
        </select>
      </div>

      {/* Anchor point — dynamic bounds prevent viewport exceeding frame */}
      <div>
        <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: "var(--text-disabled)" }}>
          <Move className="h-3 w-3 inline mr-1" />
          Anchor Point
        </label>
        {(() => {
          const half = 0.5 / zoom.scale;
          const anchorMin = Math.round(half * 100) / 100;
          const anchorMax = Math.round((1 - half) * 100) / 100;
          return (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] block mb-0.5" style={{ color: "var(--text-disabled)" }}>
                  X
                </label>
                <input
                  type="range"
                  min={anchorMin}
                  max={anchorMax}
                  step={0.05}
                  value={zoom.anchorX}
                  onChange={(e) => {
                    if (!editConfig) return;
                    const zooms = editConfig.zooms.map((z) =>
                      z.id === zoom.id ? { ...z, anchorX: parseFloat(e.target.value) } : z
                    );
                    updateEditConfigDebounced({ zooms });
                  }}
                  className="w-full accent-[var(--accent)]"
                />
              </div>
              <div>
                <label className="text-[10px] block mb-0.5" style={{ color: "var(--text-disabled)" }}>
                  Y
                </label>
                <input
                  type="range"
                  min={anchorMin}
                  max={anchorMax}
                  step={0.05}
                  value={zoom.anchorY}
                  onChange={(e) => {
                    if (!editConfig) return;
                    const zooms = editConfig.zooms.map((z) =>
                      z.id === zoom.id ? { ...z, anchorY: parseFloat(e.target.value) } : z
                    );
                    updateEditConfigDebounced({ zooms });
                  }}
                  className="w-full accent-[var(--accent)]"
                />
              </div>
            </div>
          );
        })()}
      </div>

      {/* Reason */}
      {zoom.reason && (
        <div
          className="text-[10px] px-2 py-1 rounded"
          style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
        >
          {zoom.reason}
        </div>
      )}
    </div>
  );
}

// ---- Annotation Properties ----

function AnnotationProperties({ annotation }: { annotation: AnnotationConfig }) {
  const { updateAnnotation, deleteAnnotation, selectElement } = useEditorStore();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Annotation
        </h3>
        <button
          onClick={() => {
            deleteAnnotation(annotation.id);
            selectElement(null);
          }}
          className="p-1 rounded transition-colors"
          style={{ color: "var(--error, #ef4444)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          title="Delete annotation"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <div>
        <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: "var(--text-disabled)" }}>
          Text
        </label>
        <input
          type="text"
          value={annotation.content}
          onChange={(e) => updateAnnotation(annotation.id, { content: e.target.value })}
          className="input w-full text-xs"
          placeholder="Enter text..."
        />
      </div>

      {/* Timing */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: "var(--text-disabled)" }}>
            Start
          </label>
          <input
            type="number"
            step={0.1}
            min={0}
            value={Number(annotation.startTime.toFixed(2))}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) updateAnnotation(annotation.id, { startTime: val });
            }}
            className="input w-full text-xs font-mono tabular-nums"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: "var(--text-disabled)" }}>
            End
          </label>
          <input
            type="number"
            step={0.1}
            min={annotation.startTime + 0.1}
            value={Number(annotation.endTime.toFixed(2))}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) updateAnnotation(annotation.id, { endTime: val });
            }}
            className="input w-full text-xs font-mono tabular-nums"
          />
        </div>
      </div>

      {/* Font size */}
      <div>
        <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: "var(--text-disabled)" }}>
          Font Size
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={12}
            max={80}
            step={2}
            value={annotation.style.fontSize}
            onChange={(e) =>
              updateAnnotation(annotation.id, {
                style: { ...annotation.style, fontSize: parseInt(e.target.value) },
              })
            }
            className="flex-1 accent-[var(--accent)]"
          />
          <span className="text-xs font-mono tabular-nums w-8 text-right" style={{ color: "var(--text-secondary)" }}>
            {annotation.style.fontSize}
          </span>
        </div>
      </div>

      {/* Color */}
      <div>
        <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: "var(--text-disabled)" }}>
          Color
        </label>
        <input
          type="color"
          value={annotation.style.color}
          onChange={(e) =>
            updateAnnotation(annotation.id, {
              style: { ...annotation.style, color: e.target.value },
            })
          }
          className="w-8 h-6 rounded cursor-pointer"
        />
      </div>

      {/* Bold / Italic toggles */}
      <div className="flex gap-2">
        <button
          onClick={() =>
            updateAnnotation(annotation.id, {
              style: { ...annotation.style, bold: !annotation.style.bold },
            })
          }
          className="px-3 py-1 rounded text-xs font-bold transition-all"
          style={{
            background: annotation.style.bold ? "var(--accent)" : "var(--bg-elevated)",
            color: annotation.style.bold ? "#000" : "var(--text-secondary)",
          }}
        >
          B
        </button>
        <button
          onClick={() =>
            updateAnnotation(annotation.id, {
              style: { ...annotation.style, italic: !annotation.style.italic },
            })
          }
          className="px-3 py-1 rounded text-xs italic transition-all"
          style={{
            background: annotation.style.italic ? "var(--accent)" : "var(--bg-elevated)",
            color: annotation.style.italic ? "#000" : "var(--text-secondary)",
          }}
        >
          I
        </button>
      </div>
    </div>
  );
}

// ---- Main PropertiesPanel ----

interface PropertiesPanelProps {
  config: EditConfig;
  onChange: (config: EditConfig) => void;
  onApply: () => void;
  applying: boolean;
}

export default function PropertiesPanel({
  config,
  onChange,
  onApply,
  applying,
}: PropertiesPanelProps) {
  const { selectedElement, editConfig } = useEditorStore();

  // Context-sensitive: show properties for selected element
  if (selectedElement && editConfig) {
    if (selectedElement.type === "segment") {
      const segment = editConfig.segments.find((s) => s.id === selectedElement.id);
      if (segment) {
        return (
          <div className="card p-4 space-y-4">
            <SegmentProperties segment={segment} />
            <div className="border-t pt-4" style={{ borderColor: "var(--border-subtle)" }}>
              <CaptionEditor />
            </div>
          </div>
        );
      }
    }

    if (selectedElement.type === "zoom") {
      const zoom = editConfig.zooms.find((z) => z.id === selectedElement.id);
      if (zoom) {
        return (
          <div className="card p-4 space-y-4">
            <ZoomProperties zoom={zoom} />
            <div className="border-t pt-4" style={{ borderColor: "var(--border-subtle)" }}>
              <CaptionEditor />
            </div>
          </div>
        );
      }
    }

    if (selectedElement.type === "annotation") {
      const annotation = editConfig.annotations?.find((a) => a.id === selectedElement.id);
      if (annotation) {
        return (
          <div className="card p-4 space-y-4">
            <AnnotationProperties annotation={annotation} />
          </div>
        );
      }
    }
  }

  // Default: show global EditConfigPanel + CaptionEditor
  return (
    <div className="space-y-2">
      <EditConfigPanel
        config={config}
        onChange={onChange}
        onApply={onApply}
        applying={applying}
      />
      <div className="card p-4">
        <CaptionEditor />
      </div>
    </div>
  );
}
