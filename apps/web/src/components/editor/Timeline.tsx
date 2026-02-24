"use client";

import { useRef, useCallback, useMemo, useState, useEffect } from "react";
import { useEditorStore } from "@/stores/editorStore";
import type { SegmentConfig, ZoomConfig } from "@/types/editConfig";
import { Scissors, Plus, Trash2 } from "lucide-react";
import AudioWaveform from "./AudioWaveform";
import { extractThumbnails } from "@/lib/editor/thumbnailExtractor";
import TransitionPopover from "./TransitionPopover";

/**
 * Multi-track NLE Timeline with drag interactions, snap-to-grid,
 * transition indicators, and audio waveform.
 *
 * Tracks:
 * - Segment track: video segments with draggable edges for trim adjustment
 * - Zoom track: zoom keyframes, draggable to reposition
 * - Audio track: waveform visualization (decoded from source video)
 * - Caption track: caption groups indicator
 *
 * Interactions:
 * - Click segment/zoom to select
 * - Drag left/right edge of segment to adjust cut points (with snap)
 * - Drag zoom marker to reposition in time (with snap)
 * - Click ruler/track background to seek
 * - Delete/Backspace to remove selected element
 * - Ctrl+scroll to zoom timeline
 */

// Drag state types
type DragState =
  | { type: "segment-edge"; segmentId: string; edge: "start" | "end"; initialSourceTime: number }
  | { type: "zoom-move"; zoomId: string; initialTime: number }
  | null;

const EDGE_HANDLE_WIDTH = 6; // px
const TRACK_LABEL_WIDTH = 50; // px
const SNAP_THRESHOLD_PX = 8; // snap within 8 pixels

// Transition display labels
const TRANSITION_LABELS: Record<string, string> = {
  crossfade: "X",
  fade: "F",
  wipe_left: "◀",
  wipe_right: "▶",
  slide_up: "▲",
  dissolve: "~",
  zoom_in: "Z",
  circle: "○",
};

export default function Timeline() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const trackAreaRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState>(null);
  const [dragPreviewTime, setDragPreviewTime] = useState<number | null>(null);
  const [snappedPoint, setSnappedPoint] = useState<number | null>(null);
  const dragStartXRef = useRef(0);
  const [transitionPopover, setTransitionPopover] = useState<{
    segmentId: string;
    x: number;
    y: number;
  } | null>(null);

  const {
    editConfig,
    currentTime,
    totalDuration,
    timelineZoom,
    selectedElement,
    clipStart,
    clipEnd,
    selectElement,
    splitSegment,
    adjustSegmentEdge,
    deleteSegment,
    addZoom,
    updateZoom,
    deleteZoom,
    addAnnotation,
    deleteAnnotation,
    setTimelineZoom,
    sourceVideos,
  } = useEditorStore();

  const clipDuration = clipEnd - clipStart;
  const { proxyVideoUrl, sourceVideoUrl, useProxy } = useEditorStore();
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());

  // Extract filmstrip thumbnails when video URL changes
  const videoUrlForThumbs = useProxy ? proxyVideoUrl : sourceVideoUrl;
  useEffect(() => {
    if (!videoUrlForThumbs || clipDuration <= 0) return;
    let cancelled = false;
    extractThumbnails(videoUrlForThumbs, 0, clipDuration, 2).then((thumbs) => {
      if (cancelled) return;
      const map = new Map<number, string>();
      for (const t of thumbs) map.set(t.time, t.dataUrl);
      setThumbnails(map);
    });
    return () => { cancelled = true; };
  }, [videoUrlForThumbs, clipDuration]);

  // Convert output time to pixel position
  const timeToX = useCallback(
    (time: number) => time * timelineZoom,
    [timelineZoom]
  );

  // Convert pixel position to output time
  const xToTime = useCallback(
    (x: number) => x / timelineZoom,
    [timelineZoom]
  );

  // Playhead position in pixels
  const playheadX = timeToX(currentTime);

  // Total timeline width in pixels
  const totalWidth = timeToX(totalDuration || clipDuration);

  // Compute segment positions in the output timeline
  const segmentBlocks = useMemo(() => {
    if (!editConfig?.segments) return [];

    let outputOffset = 0;
    return editConfig.segments.map((seg) => {
      const duration = seg.sourceEnd - seg.sourceStart;
      const block = {
        ...seg,
        outputStart: outputOffset,
        outputEnd: outputOffset + duration,
        width: timeToX(duration),
        left: timeToX(outputOffset),
      };
      outputOffset += duration;
      return block;
    });
  }, [editConfig?.segments, timeToX]);

  // Compute source video boundary markers in the output timeline
  const sourceBoundaryMarkers = useMemo(() => {
    if (!sourceVideos?.length || sourceVideos.length <= 1) return [];
    if (!editConfig?.segments) return [];

    const markers: { outputX: number; name: string }[] = [];

    for (let i = 1; i < sourceVideos.length; i++) {
      const boundarySourceTime = sourceVideos[i].offsetInTimeline;
      const clipRelative = boundarySourceTime - clipStart;
      if (clipRelative <= 0 || clipRelative >= clipEnd - clipStart) continue;

      for (const seg of segmentBlocks) {
        if (clipRelative >= seg.sourceStart && clipRelative <= seg.sourceEnd) {
          const outputTime = seg.outputStart + (clipRelative - seg.sourceStart);
          markers.push({
            outputX: timeToX(outputTime),
            name: sourceVideos[i].originalName,
          });
          break;
        }
      }
    }
    return markers;
  }, [sourceVideos, editConfig?.segments, segmentBlocks, clipStart, clipEnd, timeToX]);

  // Compute zoom keyframe positions (in output time)
  const zoomMarkers = useMemo(() => {
    if (!editConfig?.zooms) return [];
    return editConfig.zooms.map((zoom) => ({
      ...zoom,
      x: timeToX(zoom.time),
      width: timeToX(zoom.duration),
    }));
  }, [editConfig?.zooms, timeToX]);

  // ---- Snap logic ----

  // Compute snap points from segment boundaries, zoom positions, and grid
  const snapPoints = useMemo(() => {
    const points: number[] = [];

    // Segment boundaries
    for (const seg of segmentBlocks) {
      points.push(seg.outputStart);
      points.push(seg.outputEnd);
    }

    // Zoom positions
    for (const zoom of zoomMarkers) {
      points.push(zoom.time);
      points.push(zoom.time + zoom.duration);
    }

    // Grid: every second
    const dur = totalDuration || clipDuration;
    for (let t = 0; t <= dur; t += 1) {
      points.push(t);
    }

    // Deduplicate and sort
    return [...new Set(points.map((p) => Math.round(p * 1000) / 1000))].sort(
      (a, b) => a - b
    );
  }, [segmentBlocks, zoomMarkers, totalDuration, clipDuration]);

  // Snap a time value to nearest snap point if within threshold
  const snapTime = useCallback(
    (time: number): { time: number; snapped: boolean; snapPoint: number | null } => {
      const threshold = xToTime(SNAP_THRESHOLD_PX);
      let closest: number | null = null;
      let closestDist = Infinity;

      for (const sp of snapPoints) {
        const dist = Math.abs(time - sp);
        if (dist < threshold && dist < closestDist) {
          closest = sp;
          closestDist = dist;
        }
      }

      if (closest !== null) {
        return { time: closest, snapped: true, snapPoint: closest };
      }
      return { time, snapped: false, snapPoint: null };
    },
    [snapPoints, xToTime]
  );

  // Handle clicking on the timeline background to seek
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      if (dragState) return;
      if (!trackAreaRef.current) return;
      const rect = trackAreaRef.current.getBoundingClientRect();
      const scrollLeft = timelineRef.current?.scrollLeft || 0;
      const x = e.clientX - rect.left + scrollLeft;
      const time = Math.max(0, Math.min(xToTime(x), totalDuration));
      // Dispatch seek event so PlaybackEngine actually moves the video
      window.dispatchEvent(
        new CustomEvent("editor:seek", { detail: { time } })
      );
    },
    [xToTime, totalDuration, dragState]
  );

  // ---- Segment edge drag ----

  const handleSegmentEdgeMouseDown = useCallback(
    (e: React.MouseEvent, segmentId: string, edge: "start" | "end") => {
      e.stopPropagation();
      e.preventDefault();
      const seg = editConfig?.segments.find((s) => s.id === segmentId);
      if (!seg) return;

      dragStartXRef.current = e.clientX;
      setDragState({
        type: "segment-edge",
        segmentId,
        edge,
        initialSourceTime: edge === "start" ? seg.sourceStart : seg.sourceEnd,
      });
      setDragPreviewTime(edge === "start" ? seg.sourceStart : seg.sourceEnd);
      setSnappedPoint(null);
      selectElement({ type: "segment", id: segmentId });
    },
    [editConfig?.segments, selectElement]
  );

  // ---- Zoom drag ----

  const handleZoomMouseDown = useCallback(
    (e: React.MouseEvent, zoomId: string) => {
      e.stopPropagation();
      e.preventDefault();
      const zoom = editConfig?.zooms.find((z) => z.id === zoomId);
      if (!zoom) return;

      dragStartXRef.current = e.clientX;
      setDragState({ type: "zoom-move", zoomId, initialTime: zoom.time });
      setDragPreviewTime(zoom.time);
      setSnappedPoint(null);
      selectElement({ type: "zoom", id: zoomId });
    },
    [editConfig?.zooms, selectElement]
  );

  // Global mouse move/up for drag with snap
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartXRef.current;
      const deltaTime = xToTime(deltaX);

      if (dragState.type === "segment-edge") {
        const rawTime = Math.max(0, dragState.initialSourceTime + deltaTime);
        const snap = snapTime(rawTime);
        setDragPreviewTime(snap.time);
        setSnappedPoint(snap.snapPoint);
      } else if (dragState.type === "zoom-move") {
        const rawTime = Math.max(0, dragState.initialTime + deltaTime);
        const snap = snapTime(rawTime);
        setDragPreviewTime(snap.time);
        setSnappedPoint(snap.snapPoint);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartXRef.current;
      const deltaTime = xToTime(deltaX);

      // Only commit if we actually moved
      if (Math.abs(deltaX) > 2) {
        if (dragState.type === "segment-edge") {
          const rawTime = Math.max(0, dragState.initialSourceTime + deltaTime);
          const snap = snapTime(rawTime);
          adjustSegmentEdge(dragState.segmentId, dragState.edge, snap.time);
        } else if (dragState.type === "zoom-move") {
          const rawTime = Math.max(0, dragState.initialTime + deltaTime);
          const snap = snapTime(rawTime);
          updateZoom(dragState.zoomId, { time: snap.time });
        }
      }

      setDragState(null);
      setDragPreviewTime(null);
      setSnappedPoint(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, xToTime, adjustSegmentEdge, updateZoom, snapTime]);

  // ---- Keyboard shortcuts ----

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const sel = useEditorStore.getState().selectedElement;
        if (!sel) return;
        e.preventDefault();
        if (sel.type === "segment") {
          const segs = useEditorStore.getState().editConfig?.segments;
          if (segs && segs.length > 1) {
            deleteSegment(sel.id);
            selectElement(null);
          }
        } else if (sel.type === "zoom") {
          deleteZoom(sel.id);
          selectElement(null);
        } else if (sel.type === "annotation") {
          deleteAnnotation(sel.id);
          selectElement(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSegment, deleteZoom, selectElement]);

  const handleSplitAtPlayhead = useCallback(() => {
    if (!editConfig?.segments) return;

    let outputOffset = 0;
    for (const seg of editConfig.segments) {
      const duration = seg.sourceEnd - seg.sourceStart;
      if (currentTime >= outputOffset && currentTime <= outputOffset + duration) {
        const splitSourceTime = seg.sourceStart + (currentTime - outputOffset);
        splitSegment(seg.id, splitSourceTime);
        return;
      }
      outputOffset += duration;
    }
  }, [editConfig?.segments, currentTime, splitSegment]);

  const handleAddZoom = useCallback(() => {
    addZoom(currentTime);
  }, [currentTime, addZoom]);

  const handleAddAnnotation = useCallback(() => {
    addAnnotation(currentTime);
  }, [currentTime, addAnnotation]);

  const handleDeleteSelected = useCallback(() => {
    const sel = selectedElement;
    if (!sel) return;
    if (sel.type === "segment") {
      const segs = editConfig?.segments;
      if (segs && segs.length > 1) {
        deleteSegment(sel.id);
        selectElement(null);
      }
    } else if (sel.type === "zoom") {
      deleteZoom(sel.id);
      selectElement(null);
    } else if (sel.type === "annotation") {
      deleteAnnotation(sel.id);
      selectElement(null);
    }
  }, [selectedElement, editConfig?.segments, deleteSegment, deleteZoom, deleteAnnotation, selectElement]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -5 : 5;
        setTimelineZoom(timelineZoom + delta);
      }
    },
    [timelineZoom, setTimelineZoom]
  );

  if (!editConfig) return null;

  const isDragging = dragState !== null;
  const canDeleteSelected =
    selectedElement &&
    ((selectedElement.type === "segment" && (editConfig.segments?.length || 0) > 1) ||
      selectedElement.type === "zoom" ||
      selectedElement.type === "annotation");

  return (
    <div
      className="card"
      style={{
        background: "var(--bg-card)",
        cursor: isDragging ? "col-resize" : undefined,
        userSelect: isDragging ? "none" : undefined,
      }}
    >
      {/* Timeline toolbar */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={handleSplitAtPlayhead}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            title="Split at playhead (S)"
          >
            <Scissors className="h-3 w-3" /> Split
          </button>
          <button
            onClick={handleAddZoom}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            title="Add zoom at playhead"
          >
            <Plus className="h-3 w-3" /> Zoom
          </button>
          <button
            onClick={handleAddAnnotation}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            title="Add text annotation at playhead"
          >
            <Plus className="h-3 w-3" /> Text
          </button>
          {canDeleteSelected && (
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
              style={{ color: "var(--error, #ef4444)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              title="Delete selected (Del)"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          {/* Drag time preview + snap indicator */}
          {isDragging && dragPreviewTime !== null && (
            <span className="font-mono tabular-nums" style={{ color: "var(--accent)" }}>
              {dragPreviewTime.toFixed(2)}s
              {snappedPoint !== null && (
                <span
                  className="ml-1 text-[9px] px-1 rounded"
                  style={{
                    background: "rgba(191, 255, 10, 0.15)",
                    color: "var(--accent)",
                  }}
                >
                  SNAP
                </span>
              )}
            </span>
          )}
          <span>Zoom:</span>
          <input
            type="range"
            min={10}
            max={200}
            value={timelineZoom}
            onChange={(e) => setTimelineZoom(parseInt(e.target.value))}
            className="w-20 accent-[var(--accent)]"
          />
        </div>
      </div>

      {/* Timeline tracks */}
      <div
        ref={timelineRef}
        className="overflow-x-auto relative"
        onWheel={handleWheel}
        style={{ minHeight: "170px" }}
      >
        <div
          ref={trackAreaRef}
          className="relative"
          style={{ width: `${totalWidth + 40}px`, minWidth: "100%" }}
        >
          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 z-20 pointer-events-none"
            style={{
              left: `${playheadX}px`,
              width: "2px",
              background: "var(--accent)",
            }}
          >
            <div
              className="absolute -top-0 -left-1 w-2.5 h-2.5 rounded-full"
              style={{ background: "var(--accent)" }}
            />
          </div>

          {/* Snap indicator line — shown when dragging and snapped */}
          {isDragging && snappedPoint !== null && (
            <div
              className="absolute top-0 bottom-0 z-30 pointer-events-none"
              style={{
                left: `${timeToX(snappedPoint)}px`,
                width: "1px",
                background: "var(--accent)",
                opacity: 0.6,
                boxShadow: "0 0 6px rgba(191, 255, 10, 0.4)",
              }}
            />
          )}

          {/* Source video boundary markers */}
          {sourceBoundaryMarkers.map((marker, i) => (
            <div
              key={`src-boundary-${i}`}
              className="absolute top-0 bottom-0 z-10 pointer-events-none"
              style={{
                left: `${marker.outputX + TRACK_LABEL_WIDTH}px`,
                width: "1px",
                background: "rgba(245, 158, 11, 0.5)",
                borderLeft: "1px dashed rgba(245, 158, 11, 0.4)",
              }}
              title={marker.name}
            >
              <div
                className="absolute -top-0.5 -left-2 text-[7px] whitespace-nowrap px-1 rounded"
                style={{
                  background: "rgba(245, 158, 11, 0.15)",
                  color: "rgba(245, 158, 11, 0.8)",
                }}
              >
                {marker.name.length > 12 ? marker.name.slice(0, 12) + "…" : marker.name}
              </div>
            </div>
          ))}

          {/* Track labels + content */}
          <div className="flex flex-col">
            {/* Segment Track */}
            <div
              className="flex items-center border-b"
              style={{ borderColor: "var(--border)", height: "40px" }}
            >
              <div
                className="flex-shrink-0 px-2 text-[10px] uppercase tracking-wider"
                style={{ width: `${TRACK_LABEL_WIDTH}px`, color: "var(--text-disabled)" }}
              >
                Video
              </div>
              <div
                className="relative flex-1"
                style={{ height: "32px" }}
                onClick={handleTimelineClick}
              >
                {segmentBlocks.map((seg, idx) => {
                  const isSelected = selectedElement?.id === seg.id;
                  const prevSeg = idx > 0 ? segmentBlocks[idx - 1] : null;
                  const hasGap = prevSeg && seg.sourceStart > prevSeg.sourceEnd + 0.01;
                  const hasTransition =
                    idx > 0 &&
                    seg.transition !== "none" &&
                    seg.transition !== "hard";

                  return (
                    <div key={seg.id}>
                      {/* Gap indicator (cut region) */}
                      {hasGap && prevSeg && (
                        <div
                          className="absolute top-1 rounded-sm"
                          style={{
                            left: `${prevSeg.left + prevSeg.width}px`,
                            width: `${seg.left - (prevSeg.left + prevSeg.width)}px`,
                            height: "24px",
                            background: "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(239,68,68,0.1) 3px, rgba(239,68,68,0.1) 6px)",
                            borderRadius: "2px",
                          }}
                        />
                      )}

                      {/* Hover marker to add transition where none exists */}
                      {!hasTransition && idx > 0 && prevSeg && (
                        <div
                          className="absolute z-10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                          style={{
                            left: `${seg.left - 6}px`,
                            top: "4px",
                            width: "12px",
                            height: "12px",
                          }}
                          title="Click to add transition"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const timelineRect = timelineRef.current?.getBoundingClientRect();
                            setTransitionPopover({
                              segmentId: seg.id,
                              x: rect.left - (timelineRect?.left ?? 0),
                              y: rect.bottom - (timelineRect?.top ?? 0) + 4,
                            });
                          }}
                        >
                          <div
                            style={{
                              width: "8px",
                              height: "8px",
                              background: "rgba(139, 92, 246, 0.4)",
                              transform: "rotate(45deg)",
                              borderRadius: "1px",
                            }}
                          />
                        </div>
                      )}

                      {/* Transition indicator diamond between segments — click to edit */}
                      {hasTransition && prevSeg && (
                        <div
                          className="absolute z-10 flex items-center justify-center cursor-pointer"
                          style={{
                            left: `${seg.left - 8}px`,
                            top: "2px",
                            width: "16px",
                            height: "16px",
                          }}
                          title={`Transition: ${seg.transition} (${(seg.transitionDuration ?? 0.3).toFixed(1)}s) — click to edit`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const timelineRect = timelineRef.current?.getBoundingClientRect();
                            setTransitionPopover({
                              segmentId: seg.id,
                              x: rect.left - (timelineRect?.left ?? 0),
                              y: rect.bottom - (timelineRect?.top ?? 0) + 4,
                            });
                          }}
                        >
                          {/* Diamond background */}
                          <div
                            className="absolute"
                            style={{
                              width: "12px",
                              height: "12px",
                              background: "rgba(139, 92, 246, 0.8)",
                              transform: "rotate(45deg)",
                              borderRadius: "2px",
                            }}
                          />
                          {/* Transition type label */}
                          <span
                            className="relative text-[7px] font-bold select-none"
                            style={{ color: "#fff" }}
                          >
                            {TRANSITION_LABELS[seg.transition] || "T"}
                          </span>
                        </div>
                      )}

                      {/* Segment block */}
                      <div
                        className={`absolute top-0.5 rounded transition-colors overflow-hidden ${
                          isSelected ? "ring-2 ring-[var(--accent)]" : ""
                        }`}
                        style={{
                          left: `${seg.left}px`,
                          width: `${Math.max(seg.width, 4)}px`,
                          height: "28px",
                          background: isSelected
                            ? "var(--accent)"
                            : "rgba(191, 255, 10, 0.15)",
                          border: isSelected
                            ? undefined
                            : "1px solid rgba(191, 255, 10, 0.25)",
                          cursor: isDragging ? "col-resize" : "pointer",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isDragging) {
                            selectElement({ type: "segment", id: seg.id });
                          }
                        }}
                      >
                        {/* Filmstrip thumbnails */}
                        {thumbnails.size > 0 && (
                          <div className="absolute inset-0 flex pointer-events-none" style={{ opacity: isSelected ? 0.3 : 0.6 }}>
                            {Array.from(thumbnails.entries())
                              .filter(([t]) => t >= seg.sourceStart && t < seg.sourceEnd)
                              .map(([t, dataUrl]) => {
                                const offsetInSeg = t - seg.sourceStart;
                                const leftPx = timeToX(offsetInSeg);
                                return (
                                  <img
                                    key={t}
                                    src={dataUrl}
                                    alt=""
                                    className="absolute top-0 h-full object-cover"
                                    style={{ left: `${leftPx}px`, width: `${timeToX(2)}px` }}
                                  />
                                );
                              })}
                          </div>
                        )}
                        {/* Left edge drag handle */}
                        <div
                          className="absolute left-0 top-0 bottom-0 z-10 group"
                          style={{
                            width: `${EDGE_HANDLE_WIDTH}px`,
                            cursor: "col-resize",
                          }}
                          onMouseDown={(e) => handleSegmentEdgeMouseDown(e, seg.id, "start")}
                        >
                          <div
                            className="absolute left-0 top-1 bottom-1 rounded-l transition-opacity"
                            style={{
                              width: "3px",
                              background: "var(--accent)",
                              opacity: isSelected ? 0.8 : 0,
                            }}
                          />
                        </div>

                        {/* Segment label */}
                        <div
                          className="px-2 py-0.5 text-[9px] truncate select-none pointer-events-none"
                          style={{ color: isSelected ? "#fff" : "var(--text-primary)" }}
                        >
                          {(seg.sourceEnd - seg.sourceStart).toFixed(1)}s
                        </div>

                        {/* Right edge drag handle */}
                        <div
                          className="absolute right-0 top-0 bottom-0 z-10 group"
                          style={{
                            width: `${EDGE_HANDLE_WIDTH}px`,
                            cursor: "col-resize",
                          }}
                          onMouseDown={(e) => handleSegmentEdgeMouseDown(e, seg.id, "end")}
                        >
                          <div
                            className="absolute right-0 top-1 bottom-1 rounded-r transition-opacity"
                            style={{
                              width: "3px",
                              background: "var(--accent)",
                              opacity: isSelected ? 0.8 : 0,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Zoom Track */}
            <div
              className="flex items-center border-b"
              style={{ borderColor: "var(--border)", height: "30px" }}
            >
              <div
                className="flex-shrink-0 px-2 text-[10px] uppercase tracking-wider"
                style={{ width: `${TRACK_LABEL_WIDTH}px`, color: "var(--text-disabled)" }}
              >
                Zoom
              </div>
              <div
                className="relative flex-1"
                style={{ height: "24px" }}
                onClick={handleTimelineClick}
              >
                {zoomMarkers.map((zoom) => {
                  const isSelected = selectedElement?.id === zoom.id;
                  return (
                    <div
                      key={zoom.id}
                      className={`absolute top-1 transition-colors ${
                        isSelected ? "ring-1 ring-[var(--accent)]" : ""
                      }`}
                      style={{
                        left: `${zoom.x}px`,
                        width: `${Math.max(zoom.width, 8)}px`,
                        height: "16px",
                        background: isSelected ? "var(--accent)" : "#F59E0B",
                        opacity: isSelected ? 0.9 : 0.7,
                        borderRadius: "3px",
                        cursor: isDragging ? "col-resize" : "grab",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isDragging) {
                          selectElement({ type: "zoom", id: zoom.id });
                        }
                      }}
                      onMouseDown={(e) => handleZoomMouseDown(e, zoom.id)}
                      title={`${zoom.scale}x zoom - ${zoom.reason}`}
                    >
                      <div
                        className="px-1 text-[8px] truncate select-none pointer-events-none"
                        style={{ color: "#fff", lineHeight: "16px" }}
                      >
                        {zoom.scale.toFixed(1)}x
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Annotation Track */}
            {(editConfig.annotations?.length ?? 0) > 0 && (
              <div
                className="flex items-center border-b"
                style={{ borderColor: "var(--border)", height: "26px" }}
              >
                <div
                  className="flex-shrink-0 px-2 text-[10px] uppercase tracking-wider"
                  style={{ width: `${TRACK_LABEL_WIDTH}px`, color: "var(--text-disabled)" }}
                >
                  Annot
                </div>
                <div
                  className="relative flex-1"
                  style={{ height: "20px" }}
                  onClick={handleTimelineClick}
                >
                  {editConfig.annotations.map((ann) => {
                    const isSelected =
                      selectedElement?.type === "annotation" && selectedElement.id === ann.id;
                    const left = timeToX(ann.startTime);
                    const width = timeToX(ann.endTime - ann.startTime);
                    return (
                      <div
                        key={ann.id}
                        className={`absolute top-0.5 rounded transition-colors ${
                          isSelected ? "ring-1 ring-[var(--accent)]" : ""
                        }`}
                        style={{
                          left: `${left}px`,
                          width: `${Math.max(width, 8)}px`,
                          height: "14px",
                          background: isSelected
                            ? "var(--accent)"
                            : "rgba(236, 72, 153, 0.35)",
                          border: isSelected
                            ? undefined
                            : "1px solid rgba(236, 72, 153, 0.5)",
                          cursor: "pointer",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectElement({ type: "annotation" as any, id: ann.id });
                        }}
                        title={ann.content}
                      >
                        <span
                          className="px-1 text-[8px] truncate block"
                          style={{
                            color: isSelected ? "#000" : "var(--text-primary)",
                            lineHeight: "14px",
                          }}
                        >
                          {ann.content}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Audio Waveform Track */}
            <div
              className="flex items-center border-b"
              style={{ borderColor: "var(--border)", height: "30px" }}
            >
              <div
                className="flex-shrink-0 px-2 text-[10px] uppercase tracking-wider"
                style={{ width: `${TRACK_LABEL_WIDTH}px`, color: "var(--text-disabled)" }}
              >
                Audio
              </div>
              <AudioWaveform
                timelineZoom={timelineZoom}
                onClick={handleTimelineClick}
              />
            </div>

            {/* Caption Track */}
            <div className="flex items-center" style={{ height: "30px" }}>
              <div
                className="flex-shrink-0 px-2 text-[10px] uppercase tracking-wider"
                style={{ width: `${TRACK_LABEL_WIDTH}px`, color: "var(--text-disabled)" }}
              >
                Text
              </div>
              <div
                className="relative flex-1"
                style={{ height: "24px" }}
                onClick={handleTimelineClick}
              >
                <div
                  className="absolute top-1 rounded"
                  style={{
                    left: "0px",
                    width: `${totalWidth}px`,
                    height: "16px",
                    background: editConfig.captions.enabled
                      ? "rgba(59, 130, 246, 0.2)"
                      : "transparent",
                    border: editConfig.captions.enabled
                      ? "1px solid rgba(59, 130, 246, 0.3)"
                      : "none",
                    borderRadius: "3px",
                  }}
                >
                  <span
                    className="px-1 text-[9px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {editConfig.captions.enabled
                      ? editConfig.captions.style
                      : "disabled"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Transition popover */}
          {transitionPopover && editConfig && (() => {
            const seg = editConfig.segments.find((s) => s.id === transitionPopover.segmentId);
            if (!seg) return null;
            return (
              <TransitionPopover
                segmentId={transitionPopover.segmentId}
                currentTransition={seg.transition}
                currentDuration={seg.transitionDuration ?? 0.3}
                position={{ x: transitionPopover.x, y: transitionPopover.y }}
                onClose={() => setTransitionPopover(null)}
              />
            );
          })()}

          {/* Time ruler */}
          <div
            className="border-t relative"
            style={{
              borderColor: "var(--border)",
              height: "20px",
              marginLeft: `${TRACK_LABEL_WIDTH}px`,
            }}
            onClick={handleTimelineClick}
          >
            {Array.from(
              { length: Math.ceil(totalDuration || clipDuration) + 1 },
              (_, i) => (
                <div
                  key={i}
                  className="absolute top-0"
                  style={{ left: `${timeToX(i)}px` }}
                >
                  <div
                    className="w-px"
                    style={{
                      height: i % 5 === 0 ? "10px" : "5px",
                      background: "var(--border)",
                    }}
                  />
                  {i % 5 === 0 && (
                    <span
                      className="absolute top-2 text-[9px] -translate-x-1/2"
                      style={{ color: "var(--text-disabled)" }}
                    >
                      {Math.floor(i / 60)}:{(i % 60).toString().padStart(2, "0")}
                    </span>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
