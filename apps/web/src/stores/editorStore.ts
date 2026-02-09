/**
 * Zustand store for the NLE editor.
 *
 * Manages:
 * - EditConfig state with undo/redo
 * - UI state (selected element, timeline zoom)
 * - Playback state (synced from PlaybackEngine)
 * - Auto-save to Firestore (debounced)
 */

import { create } from "zustand";
import type { EditConfig, SegmentConfig, ZoomConfig, CaptionConfig, CaptionOverride } from "@/types/editConfig";
import type { Clip } from "@/types/clip";
import type { Project, Word, SourceVideo } from "@/types/project";
import { segmentsToCuts } from "@/lib/editor/segments";
import {
  splitSegment as splitSeg,
  adjustSegmentEdge as adjustEdge,
  deleteSegment as deleteSeg,
} from "@/lib/editor/segments";

// ---- Types ----

export type SelectedElementType = "segment" | "caption" | "zoom" | null;

export interface SelectedElement {
  type: "segment" | "caption" | "zoom";
  id: string;
  index?: number;
}

interface EditorState {
  // Source data (immutable after load)
  clip: Clip | null;
  project: Project | null;
  sourceVideoUrl: string | null;
  proxyVideoUrl: string | null;
  useProxy: boolean;
  sourceVideos: SourceVideo[];
  transcript: Word[];
  clipStart: number;
  clipEnd: number;

  // Edit state with undo/redo
  editConfig: EditConfig | null;
  editHistory: EditConfig[];
  editFuture: EditConfig[];

  // UI state
  selectedElement: SelectedElement | null;
  timelineZoom: number; // pixels per second
  timelineScroll: number;

  // Playback state (synced from PlaybackEngine via setPlaybackState)
  isPlaying: boolean;
  currentTime: number; // output time
  totalDuration: number;

  // Save state
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: number | null;

  // Actions
  initialize: (params: {
    clip: Clip;
    project: Project;
    sourceVideoUrl: string;
    proxyVideoUrl?: string | null;
    sourceVideos?: SourceVideo[];
    transcript: Word[];
    clipStart: number;
    clipEnd: number;
  }) => void;
  toggleProxy: () => void;
  setPlaybackState: (isPlaying: boolean, currentTime: number, totalDuration: number) => void;
  updateEditConfig: (changes: Partial<EditConfig>) => void;
  undo: () => void;
  redo: () => void;
  selectElement: (element: SelectedElement | null) => void;
  setTimelineZoom: (zoom: number) => void;
  setTimelineScroll: (scroll: number) => void;
  markSaved: () => void;
  markSaving: () => void;

  // Segment actions
  splitSegment: (segmentId: string, atSourceTime: number) => void;
  deleteSegment: (segmentId: string) => void;
  adjustSegmentEdge: (segmentId: string, edge: "start" | "end", newTime: number) => void;

  // Zoom actions
  addZoom: (time: number) => void;
  updateZoom: (zoomId: string, changes: Partial<ZoomConfig>) => void;
  deleteZoom: (zoomId: string) => void;

  // Caption actions
  updateCaptionText: (wordIndex: number, newText: string) => void;
  toggleWordHighlight: (wordIndex: number) => void;
  hideWord: (wordIndex: number) => void;
  updateCaptionStyle: (changes: Partial<CaptionConfig>) => void;
}

// ---- Helpers ----

const MAX_HISTORY = 50;

function pushHistory(state: EditorState): Pick<EditorState, "editHistory" | "editFuture"> {
  if (!state.editConfig) return { editHistory: state.editHistory, editFuture: state.editFuture };
  const history = [...state.editHistory, state.editConfig].slice(-MAX_HISTORY);
  return { editHistory: history, editFuture: [] };
}

function syncCutsFromSegments(config: EditConfig, clipDuration: number): EditConfig {
  // Keep cuts in sync with segments for backward compat
  const cuts = segmentsToCuts(config.segments, clipDuration);
  return { ...config, cuts };
}

// ---- Store ----

export const useEditorStore = create<EditorState>((set, get) => ({
  // Initial state
  clip: null,
  project: null,
  sourceVideoUrl: null,
  proxyVideoUrl: null,
  useProxy: true, // Default to proxy for faster loading
  sourceVideos: [],
  transcript: [],
  clipStart: 0,
  clipEnd: 0,
  editConfig: null,
  editHistory: [],
  editFuture: [],
  selectedElement: null,
  timelineZoom: 50, // 50px per second default
  timelineScroll: 0,
  isPlaying: false,
  currentTime: 0,
  totalDuration: 0,
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,

  initialize: ({ clip, project, sourceVideoUrl, proxyVideoUrl, sourceVideos, transcript, clipStart, clipEnd }) => {
    set({
      clip,
      project,
      sourceVideoUrl,
      proxyVideoUrl: proxyVideoUrl || null,
      useProxy: !!proxyVideoUrl, // Start with proxy if available
      sourceVideos: sourceVideos || [],
      transcript,
      clipStart,
      clipEnd,
      editConfig: clip.editConfig,
      editHistory: [],
      editFuture: [],
      selectedElement: null,
      isDirty: false,
    });
  },

  toggleProxy: () => {
    const { proxyVideoUrl, useProxy } = get();
    if (!proxyVideoUrl) return; // No proxy available
    set({ useProxy: !useProxy });
  },

  setPlaybackState: (isPlaying, currentTime, totalDuration) => {
    set({ isPlaying, currentTime, totalDuration });
  },

  updateEditConfig: (changes) => {
    const state = get();
    if (!state.editConfig) return;

    const historyUpdate = pushHistory(state);
    const clipDuration = state.clipEnd - state.clipStart;
    let newConfig = { ...state.editConfig, ...changes };

    // If segments changed, sync cuts
    if (changes.segments) {
      newConfig = syncCutsFromSegments(newConfig, clipDuration);
    }

    set({
      editConfig: newConfig,
      ...historyUpdate,
      isDirty: true,
    });
  },

  undo: () => {
    const { editHistory, editConfig, editFuture } = get();
    if (!editHistory.length || !editConfig) return;

    const previous = editHistory[editHistory.length - 1];
    set({
      editConfig: previous,
      editHistory: editHistory.slice(0, -1),
      editFuture: [editConfig, ...editFuture],
      isDirty: true,
    });
  },

  redo: () => {
    const { editFuture, editConfig, editHistory } = get();
    if (!editFuture.length || !editConfig) return;

    const next = editFuture[0];
    set({
      editConfig: next,
      editHistory: [...editHistory, editConfig],
      editFuture: editFuture.slice(1),
      isDirty: true,
    });
  },

  selectElement: (element) => set({ selectedElement: element }),
  setTimelineZoom: (zoom) => set({ timelineZoom: Math.max(10, Math.min(200, zoom)) }),
  setTimelineScroll: (scroll) => set({ timelineScroll: Math.max(0, scroll) }),
  markSaved: () => set({ isDirty: false, isSaving: false, lastSavedAt: Date.now() }),
  markSaving: () => set({ isSaving: true }),

  // ---- Segment Actions ----

  splitSegment: (segmentId, atSourceTime) => {
    const state = get();
    if (!state.editConfig) return;

    const historyUpdate = pushHistory(state);
    const newSegments = splitSeg(state.editConfig.segments, segmentId, atSourceTime);
    const clipDuration = state.clipEnd - state.clipStart;
    let newConfig = { ...state.editConfig, segments: newSegments };
    newConfig = syncCutsFromSegments(newConfig, clipDuration);

    set({ editConfig: newConfig, ...historyUpdate, isDirty: true });
  },

  deleteSegment: (segmentId) => {
    const state = get();
    if (!state.editConfig) return;

    const historyUpdate = pushHistory(state);
    const newSegments = deleteSeg(state.editConfig.segments, segmentId);
    const clipDuration = state.clipEnd - state.clipStart;
    let newConfig = { ...state.editConfig, segments: newSegments };
    newConfig = syncCutsFromSegments(newConfig, clipDuration);

    set({ editConfig: newConfig, ...historyUpdate, isDirty: true });
  },

  adjustSegmentEdge: (segmentId, edge, newTime) => {
    const state = get();
    if (!state.editConfig) return;

    const historyUpdate = pushHistory(state);
    const newSegments = adjustEdge(state.editConfig.segments, segmentId, edge, newTime);
    const clipDuration = state.clipEnd - state.clipStart;
    let newConfig = { ...state.editConfig, segments: newSegments };
    newConfig = syncCutsFromSegments(newConfig, clipDuration);

    set({ editConfig: newConfig, ...historyUpdate, isDirty: true });
  },

  // ---- Zoom Actions ----

  addZoom: (time) => {
    const state = get();
    if (!state.editConfig) return;

    const historyUpdate = pushHistory(state);
    const newZoom: ZoomConfig = {
      id: `z_${Date.now().toString(36)}`,
      time,
      duration: 0.5,
      scale: 1.15,
      easing: "ease_in_out",
      anchorX: 0.5,
      anchorY: 0.4,
      reason: "manual",
    };

    set({
      editConfig: { ...state.editConfig, zooms: [...state.editConfig.zooms, newZoom] },
      ...historyUpdate,
      isDirty: true,
      selectedElement: { type: "zoom", id: newZoom.id },
    });
  },

  updateZoom: (zoomId, changes) => {
    const state = get();
    if (!state.editConfig) return;

    const historyUpdate = pushHistory(state);
    const zooms = state.editConfig.zooms.map((z) =>
      z.id === zoomId ? { ...z, ...changes } : z
    );

    set({
      editConfig: { ...state.editConfig, zooms },
      ...historyUpdate,
      isDirty: true,
    });
  },

  deleteZoom: (zoomId) => {
    const state = get();
    if (!state.editConfig) return;

    const historyUpdate = pushHistory(state);
    const zooms = state.editConfig.zooms.filter((z) => z.id !== zoomId);

    set({
      editConfig: { ...state.editConfig, zooms },
      ...historyUpdate,
      isDirty: true,
      selectedElement: state.selectedElement?.id === zoomId ? null : state.selectedElement,
    });
  },

  // ---- Caption Actions ----

  updateCaptionText: (wordIndex, newText) => {
    const state = get();
    if (!state.editConfig) return;

    const historyUpdate = pushHistory(state);
    const overrides = { ...state.editConfig.captionOverrides };
    overrides[wordIndex] = { ...overrides[wordIndex], text: newText };

    set({
      editConfig: { ...state.editConfig, captionOverrides: overrides },
      ...historyUpdate,
      isDirty: true,
    });
  },

  toggleWordHighlight: (wordIndex) => {
    const state = get();
    if (!state.editConfig) return;

    const historyUpdate = pushHistory(state);
    const overrides = { ...state.editConfig.captionOverrides };
    const existing = overrides[wordIndex] as CaptionOverride | undefined;
    overrides[wordIndex] = { ...existing, highlight: !(existing?.highlight) };

    set({
      editConfig: { ...state.editConfig, captionOverrides: overrides },
      ...historyUpdate,
      isDirty: true,
    });
  },

  hideWord: (wordIndex) => {
    const state = get();
    if (!state.editConfig) return;

    const historyUpdate = pushHistory(state);
    const overrides = { ...state.editConfig.captionOverrides };
    const existing = overrides[wordIndex] as CaptionOverride | undefined;
    overrides[wordIndex] = { ...existing, hidden: !(existing?.hidden) };

    set({
      editConfig: { ...state.editConfig, captionOverrides: overrides },
      ...historyUpdate,
      isDirty: true,
    });
  },

  updateCaptionStyle: (changes) => {
    const state = get();
    if (!state.editConfig) return;

    const historyUpdate = pushHistory(state);
    const captions = { ...state.editConfig.captions, ...changes };

    set({
      editConfig: { ...state.editConfig, captions },
      ...historyUpdate,
      isDirty: true,
    });
  },
}));
