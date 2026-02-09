# ClipAI - Browser NLE Editor Plan

## The Problem

Current architecture has a fatal loop: **every change requires a full server-side re-render**. User changes caption color → waits 2 minutes for Modal to re-render → sees result → wants to tweak → waits 2 more minutes. This kills the editing experience.

Additionally, there are three critical bugs in the current pipeline:

### Bug 1: Caption Drift (Captions Fall Behind)
**Root cause:** The render pipeline applies cuts in step 2 (removing dead air), which shifts the video timeline. But captions in step 5 still reference the ORIGINAL word timestamps from Deepgram. If 5 seconds of silence are removed before t=30, all captions after that point are 5 seconds late. The drift accumulates with each cut - more cuts = worse drift.

**Fix:** After applying cuts, remap all word timestamps to the new post-cut timeline. Build a time mapping function: `originalTime → postCutTime`.

### Bug 2: Zooms Don't Work
**Root cause:** The zoom step in `renderer.py` is marked as non-critical (`try/except` that silently continues). The FFmpeg scale+crop expression is likely failing due to complex time-based conditionals. Same timeline remapping issue as captions - zoom timestamps reference pre-cut timeline.

**Fix:** Debug the FFmpeg expression. Apply the same post-cut time remapping to zoom keyframes. Remove the silent failure - log errors properly.

### Bug 3: Abrupt Cuts (No J-Cuts)
**Root cause:** The cut system just hard-splices video segments together using FFmpeg `trim` + `concat`. There's no audio crossfade, no brief overlap, no smoothing. The audio cuts mid-waveform creating pops and jarring transitions.

**Fix:** Add a small audio crossfade (50-100ms) between segments. Use FFmpeg `acrossfade` filter or overlap segments slightly with fade in/out.

---

## The Vision

Transform ClipAI from "upload → wait → download" into an **interactive editing experience**:

```
CURRENT FLOW (painful):
Upload → AI processes (3-5 min) → See rendered result → Change caption color
→ Re-render (2 min) → See result → Change zoom → Re-render (2 min) → ...

NEW FLOW (instant):
Upload → AI processes (3-5 min) → See REAL-TIME PREVIEW in browser
→ Drag timeline to adjust cuts → instant preview
→ Change caption style → instant preview
→ Adjust zoom keyframes → instant preview
→ Edit caption text → instant preview
→ Satisfied? Click "Export" → Final render (2 min) → Download
```

The key insight: **preview in the browser using the original source video + HTML/CSS overlays. Only render once, as the final export step.**

---

## Architecture: Browser-Based Playback Engine

### Core Concept

Play the ORIGINAL source video in an HTML5 `<video>` element. Apply all editConfig effects as real-time overlays:

| Effect | Browser Preview Method | Final Render Method |
|--------|----------------------|-------------------|
| **Cuts** | Custom playback controller skips cut segments via `currentTime` seeks | FFmpeg trim + concat (existing) |
| **Zooms** | CSS `transform: scale()` + `transform-origin` on video container | FFmpeg scale + crop (existing, fixed) |
| **Captions** | HTML elements absolutely positioned over video, synced to playback time | FFmpeg drawtext (existing, with time remapping fix) |
| **Aspect ratio** | CSS `object-fit` + `object-position` + container sizing | FFmpeg crop (existing) |
| **Transitions** | CSS animations (opacity, transform) between segments | FFmpeg filters (existing) |
| **Reframing** | CSS `object-position` shifts to track face | FFmpeg crop (existing) |

### Why HTML5 Video + CSS (Not Remotion, Canvas, or WebCodecs)

**Remotion** - Adds significant complexity. Requires maintaining React compositions that mirror the FFmpeg pipeline. The dual-render consistency problem (browser vs server must match pixel-perfect) is hard. Overkill for our needs.

**Canvas/WebGL** - More power than we need. HTML/CSS handles text overlays, transforms, and positioning perfectly. Can upgrade to Canvas later for advanced effects (filters, blend modes, particles).

**WebCodecs** - Too low-level. Great for frame-by-frame processing but we don't need that for preview. Browser support still limited.

**HTML5 + CSS** - Simplest, fastest to implement, GPU-accelerated transforms, native text rendering for captions, works on all browsers. Good enough for 95% of editing preview. The final render (FFmpeg on server) handles the remaining 5% (exact frame-accurate cuts, encoding quality).

### Playback Engine Design

```typescript
class PlaybackEngine {
  private video: HTMLVideoElement       // Original source video
  private editConfig: EditConfig        // Current edit state
  private segments: Segment[]           // Computed keep-segments (inverse of cuts)
  private timeMap: TimeMap              // originalTime ↔ outputTime mapping
  private currentSegmentIndex: number
  private isPlaying: boolean
  private animationFrameId: number

  // Core loop - runs every frame via requestAnimationFrame
  tick() {
    const outputTime = this.getOutputTime()

    // 1. Check if we hit a cut boundary - if so, seek to next segment
    if (this.isInCutRegion(outputTime)) {
      this.seekToNextSegment()
      return
    }

    // 2. Apply zoom for current time
    const zoom = this.getActiveZoom(outputTime)
    this.applyZoomCSS(zoom)

    // 3. Update captions for current time
    const caption = this.getActiveCaption(outputTime)
    this.updateCaptionOverlay(caption)

    // 4. Fire time update events (for timeline cursor)
    this.emit('timeupdate', outputTime)

    if (this.isPlaying) {
      this.animationFrameId = requestAnimationFrame(() => this.tick())
    }
  }
}
```

### Time Mapping (Critical Component)

The `TimeMap` handles conversion between three timelines:

```
SOURCE TIMELINE:     |---A---|##CUT##|---B---|##CUT##|---C---|
                     0       5       7       12      14      30

OUTPUT TIMELINE:     |---A---|---B---|---C---|
                     0       5       10      26

(A = 5s, B = 5s, C = 16s → total output = 26s instead of 30s)
```

```typescript
class TimeMap {
  private segments: { sourceStart: number; sourceEnd: number; outputStart: number }[]

  // Convert output time (what user sees) to source time (where to seek video)
  outputToSource(outputTime: number): number

  // Convert source time (from transcript) to output time (for display)
  sourceToOutput(sourceTime: number): number

  // Get total output duration (after cuts)
  get totalDuration(): number
}
```

This same TimeMap is used to:
- Remap caption timestamps for preview AND server render
- Remap zoom timestamps for preview AND server render
- Position the timeline cursor correctly
- Calculate segment positions in the timeline UI

---

## editConfig Evolution

### Current: "Cuts" (Segments to REMOVE)

```typescript
cuts: [
  { id: "c1", start: 5.0, end: 7.0, reason: "silence" },
  { id: "c2", start: 12.0, end: 14.0, reason: "filler" },
]
```

### New: "Segments" (Parts to KEEP, in order)

```typescript
segments: [
  {
    id: "seg_1",
    sourceStart: 0.0,       // where this segment starts in original video
    sourceEnd: 5.0,          // where it ends in original video
    transition: "none",      // transition INTO this segment
  },
  {
    id: "seg_2",
    sourceStart: 7.0,
    sourceEnd: 12.0,
    transition: "crossfade", // crossfade from previous segment
  },
  {
    id: "seg_3",
    sourceStart: 14.0,
    sourceEnd: 30.0,
    transition: "hard",
  },
]
```

### Why Segments > Cuts

| Capability | Cuts Model | Segments Model |
|-----------|-----------|---------------|
| Remove silence | Yes | Yes (gap between segments) |
| Adjust cut points | Modify cut start/end | Drag segment edges |
| Reorder sections | No | Yes (reorder array) |
| Split a segment | Complex | Natural (split into two) |
| Per-segment transitions | No | Yes (transition per segment) |
| Visual timeline | Awkward (show negatives) | Natural (show positives) |
| Speed per segment | No | Yes (add speed field later) |

### Backward Compatibility

Simple conversion:
```typescript
// cuts → segments
function cutsToSegments(cuts: Cut[], videoDuration: number): Segment[] {
  // Sort cuts by start time
  // Calculate keep regions between cuts
  // Return as segments
}

// segments → cuts (for server render compatibility)
function segmentsToCuts(segments: Segment[], videoDuration: number): Cut[] {
  // Calculate gaps between segments
  // Return as cuts
}
```

The editConfig keeps both representations during transition. The NLE UI works with segments. The server renderer can consume either.

### Updated editConfig Schema

```typescript
interface EditConfig {
  // NEW - primary representation for NLE
  segments: SegmentConfig[]

  // KEPT - for backward compat with server renderer (auto-computed from segments)
  cuts: CutConfig[]

  // UNCHANGED
  zooms: ZoomConfig[]
  reframing: ReframingConfig
  captions: CaptionConfig
  transitions: TransitionConfig  // global defaults, segments override per-segment
  audio: AudioConfig
  overlays: OverlayConfig

  // NEW - caption text overrides (user edits to AI transcription)
  captionOverrides: {
    [wordIndex: number]: {
      text?: string           // corrected text
      hidden?: boolean        // hide this word
      highlight?: boolean     // force highlight
    }
  }
}
```

---

## NLE UI Components

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  Toolbar: Undo/Redo │ Zoom In/Out │ Play/Pause │ Export │
├──────────────────────────┬──────────────────────────────┤
│                          │                              │
│     VIDEO PREVIEW        │     PROPERTIES PANEL         │
│     (9:16 aspect)        │                              │
│                          │     [Context-sensitive]       │
│     ┌──────────┐         │     - Caption style/text     │
│     │          │         │     - Zoom settings           │
│     │  Video   │         │     - Segment properties      │
│     │  Player  │         │     - Audio controls          │
│     │  + CSS   │         │     - Effect settings          │
│     │ overlays │         │                              │
│     │          │         │                              │
│     └──────────┘         │                              │
│                          │                              │
├──────────────────────────┴──────────────────────────────┤
│  TIMELINE                                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ▶ Video:  [===seg1===]  [===seg2===]  [==seg3==]  │  │
│  │ ♪ Audio:  [~~~waveform across segments~~~~~~~~~~~~]│  │
│  │ T Caption:[hello world] [this is]  [awesome video] │  │
│  │ ⊕ Zooms:  ◆           ◆      ◆                    │  │
│  └────────────────────────────────────────────────────┘  │
│  |0:00    |0:05    |0:10    |0:15    |0:20    |0:25     │
└─────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### 1. PlaybackEngine (Core - No UI)
**File:** `lib/editor/PlaybackEngine.ts`

The brain. Manages video playback, time mapping, and effect synchronization. All other components subscribe to its state.

```typescript
interface PlaybackEngineState {
  isPlaying: boolean
  outputTime: number          // current time in the output timeline
  sourceTime: number          // corresponding time in source video
  totalDuration: number       // total output duration
  currentSegmentIndex: number
  activeZoom: ZoomConfig | null
  activeCaptions: CaptionGroup[]
}
```

#### 2. VideoPreview (Upgraded)
**File:** `components/editor/VideoPreview.tsx`

Shows the source video with CSS overlays. Receives zoom/caption state from PlaybackEngine.

```
┌─────────────────┐
│  <video> element │ ← CSS transform for zoom
│  ┌─────────────┐│
│  │  Caption     ││ ← Absolutely positioned HTML
│  │  overlay     ││
│  └─────────────┘│
└─────────────────┘
```

- Video plays the original source file
- Container div applies zoom via CSS transform
- Caption div overlays text synced to playback time
- Aspect ratio handled by container CSS

#### 3. Timeline
**File:** `components/editor/Timeline.tsx`

Multi-track timeline with drag interactions.

**Tracks:**
- **Video Track:** Shows segments as colored blocks. Gaps between segments = cuts. Drag left/right edges to adjust in/out points. Click gap to restore cut region. Right-click segment to split.
- **Caption Track:** Shows caption groups as text blocks. Click to edit text. Drag edges to adjust timing.
- **Zoom Track:** Shows zoom keyframes as diamond markers on a horizontal line. Drag to reposition. Click to select and edit in properties panel.
- **Audio Track:** (Stretch goal) Waveform visualization. Shows where sound effects and music are placed.

**Interactions:**
- Horizontal scroll/pinch to zoom timeline
- Playhead (vertical red line) shows current position, draggable for scrubbing
- Hover on segment edges shows resize cursor
- Drag segment edges for ripple edit (adjusts cut points)
- Keyboard: Space = play/pause, J/K/L = shuttle, Left/Right = frame step, I/O = set in/out

#### 4. PropertiesPanel
**File:** `components/editor/PropertiesPanel.tsx`

Context-sensitive panel that changes based on what's selected:

- **Nothing selected:** Global settings (aspect ratio, audio normalize, export settings)
- **Segment selected:** Segment properties (source in/out points, transition type, speed)
- **Caption selected:** Caption text editor, style picker, colors, position, font size
- **Zoom selected:** Zoom scale, duration, easing, anchor point

#### 5. CaptionEditor (Inline)
**File:** `components/editor/CaptionEditor.tsx`

When a caption group is selected in the timeline or properties panel:
- Show the transcript text for that time range
- Allow direct text editing (fix typos, rewrite)
- Per-word controls: highlight toggle, hide toggle
- Preview updates instantly as user types

#### 6. Toolbar
**File:** `components/editor/Toolbar.tsx`

- Undo/Redo stack (all editConfig changes are undoable)
- Timeline zoom controls (zoom in/out the timeline view)
- Play/Pause/Stop
- Current time display
- Export button (triggers final render)
- Aspect ratio quick-switch (9:16 / 1:1 / 4:5)

---

## State Management

### Zustand Store

```typescript
interface EditorStore {
  // Source data (immutable after load)
  clip: Clip
  project: Project
  sourceVideoUrl: string
  transcript: Transcript

  // Edit state (mutable, undo/redo stack)
  editConfig: EditConfig
  editHistory: EditConfig[]     // undo stack
  editFuture: EditConfig[]      // redo stack

  // UI state
  selectedElement: SelectedElement | null  // segment, caption, zoom, or null
  timelineZoom: number          // pixels per second
  timelineScroll: number        // horizontal scroll position

  // Playback state (from PlaybackEngine)
  isPlaying: boolean
  currentTime: number

  // Actions
  updateEditConfig: (partial: Partial<EditConfig>) => void
  undo: () => void
  redo: () => void
  selectElement: (element: SelectedElement | null) => void

  // Segment actions
  splitSegment: (segmentId: string, atTime: number) => void
  deleteSegment: (segmentId: string) => void
  adjustSegmentEdge: (segmentId: string, edge: 'start' | 'end', newTime: number) => void
  reorderSegments: (fromIndex: number, toIndex: number) => void

  // Zoom actions
  addZoom: (time: number) => void
  updateZoom: (zoomId: string, changes: Partial<ZoomConfig>) => void
  deleteZoom: (zoomId: string) => void

  // Caption actions
  updateCaptionText: (wordIndex: number, newText: string) => void
  toggleWordHighlight: (wordIndex: number) => void
  updateCaptionStyle: (changes: Partial<CaptionConfig>) => void
}
```

### Undo/Redo

Every editConfig change pushes the previous state onto the undo stack. This gives free undo/redo for ALL editing operations (cut adjustments, caption edits, zoom changes, style changes).

```typescript
updateEditConfig: (partial) => {
  const current = get().editConfig
  set({
    editHistory: [...get().editHistory, current],
    editFuture: [],  // clear redo stack on new change
    editConfig: { ...current, ...partial },
  })
}
```

---

## Data Flow

### Loading the Editor

```
1. User navigates to /editor/[clipId]
2. Fetch clip document from Firestore (contains editConfig, source times)
3. Fetch project document (contains transcript, raw video URL)
4. Get signed URL for source video from Firebase Storage
5. Initialize PlaybackEngine with source video URL + editConfig
6. Initialize Zustand store with all data
7. Render NLE UI
```

### Real-Time Preview Loop

```
User changes editConfig (e.g., drags segment edge)
         ↓
Zustand store updates editConfig
         ↓
PlaybackEngine recomputes TimeMap (segments changed → new time mapping)
         ↓
If playing:
  - PlaybackEngine adjusts video.currentTime if needed
  - CSS zoom updates on next tick()
  - Caption overlay updates on next tick()
If paused:
  - Seek to equivalent position in new timeline
  - Update zoom + captions for current frame
         ↓
Timeline UI re-renders with new segment positions
Properties panel updates if selected element changed
```

### Saving (Auto-Save)

```
editConfig changes (debounced 2 seconds)
         ↓
Convert segments → cuts (for backward compat)
         ↓
Save editConfig to Firestore (clip document)
         ↓
User's changes persist across sessions
No render triggered - just data save
```

### Exporting (Final Render)

```
User clicks "Export"
         ↓
Validate editConfig (segments exist, valid times, etc.)
         ↓
Save final editConfig to Firestore
         ↓
Call Cloud Function → triggers Modal render
         ↓
Modal downloads source video + reads editConfig from Firestore
         ↓
Server-side FFmpeg render pipeline (FIXED version):
  1. Extract segments (not clip + cuts, but direct segment extraction)
  2. Apply zoom keyframes (with correct post-cut timestamps)
  3. Render captions (with correct post-cut timestamps + user text overrides)
  4. Audio processing (normalize, crossfade between segments)
  5. Final encode (1080x1920 H.264)
         ↓
Upload to Firebase Storage
         ↓
Update clip.status = "done", clip.rendered.videoUrl
         ↓
Frontend shows download button
```

---

## Implementation Phases

### Phase 0: Fix Critical Bugs (2-3 days)
*Fix the three bugs in the current pipeline before building the NLE.*

**0.1 Build TimeMap utility (Python + TypeScript)**
- Python version in `processing/pipeline/time_map.py` for server render
- TypeScript version in `apps/web/src/lib/editor/TimeMap.ts` for browser
- Both must produce identical mappings given the same cuts/segments
- Unit tests with known inputs/outputs

**0.2 Fix caption drift**
- In `renderer.py`: after `apply_cuts()`, compute TimeMap from cuts
- Before `render_captions()`, remap all word timestamps using TimeMap
- Verify: captions match spoken words throughout entire clip

**0.3 Fix zoom failures**
- Debug the FFmpeg scale+crop expression in `apply_zooms()`
- Apply same TimeMap remapping to zoom timestamps
- Remove silent failure - log errors, return previous step's output explicitly
- Verify: zooms visibly happen at key moments

**0.4 Fix abrupt cuts**
- Add 50-100ms audio crossfade between segments in `apply_cuts()`
- Use FFmpeg `acrossfade` filter or manual fade out/in on segment boundaries
- Verify: cuts sound smooth, no audio pops

### Phase 1: Playback Engine + Basic Preview (5-7 days)
*Replace the "play rendered video" preview with a real-time engine.*

**1.1 Source video loading**
- Fetch original source video URL (not rendered) from Firebase Storage
- Load into HTML5 `<video>` element with `preload="auto"`
- Handle CORS, signed URLs, caching

**1.2 PlaybackEngine core**
- `lib/editor/PlaybackEngine.ts`
- Implements tick loop with `requestAnimationFrame`
- Manages play/pause/seek
- Skips over cut regions by seeking `video.currentTime`
- Fires `timeupdate` events on output timeline

**1.3 TimeMap (TypeScript)**
- `lib/editor/TimeMap.ts`
- Bidirectional mapping: outputTime ↔ sourceTime
- Computed from segments array
- Used by all preview components

**1.4 Zoom preview via CSS**
- Apply `transform: scale(X)` to video container
- Apply `transform-origin: X% Y%` for anchor point
- Interpolate scale value based on zoom easing over duration
- Smooth 60fps transitions

**1.5 Caption preview via HTML overlay**
- Absolutely positioned div over video
- Group words by `maxWordsPerLine` + timing
- Show/hide caption groups based on current output time
- Apply caption styles (color, size, position, font) via CSS
- Word-by-word highlight for hormozi style

**1.6 Aspect ratio preview**
- Container sizing for 9:16, 1:1, 4:5
- `object-fit: cover` + `object-position` for reframing
- Instant switch between ratios

**1.7 Replace current VideoPreview**
- Swap out the rendered video player with the new engine
- Side by side: new preview engine + existing controls panel
- Verify it looks and feels like the rendered output

### Phase 2: Timeline Component (5-7 days)
*Build the multi-track timeline for visual editing.*

**2.1 Timeline foundation**
- `components/editor/Timeline.tsx`
- Horizontal scrollable container
- Time ruler at bottom (shows seconds/minutes)
- Playhead (vertical line at current time, draggable)
- Zoom controls (pixels per second)

**2.2 Video/Segment track**
- Show segments as colored blocks proportional to duration
- Gaps between segments represent cuts
- Waveform thumbnail inside segments (stretch goal)
- Segment labels (could show first few words of transcript)

**2.3 Segment interactions**
- Drag left edge = adjust segment start (sourceStart)
- Drag right edge = adjust segment end (sourceEnd)
- Click on gap = restore that region (merge adjacent segments)
- Right-click segment = split at playhead position
- Delete key = remove segment
- Drag to reorder (stretch goal)
- All changes update editConfig → PlaybackEngine recomputes → preview updates instantly

**2.4 Caption track**
- Show caption groups as text blocks
- Positioned according to output timeline
- Click caption block = select it (shows in properties panel)
- Drag edges to adjust timing

**2.5 Zoom track**
- Show zoom keyframes as diamond markers
- Horizontal line representing zoom intensity (height = scale)
- Drag marker left/right to adjust timing
- Drag marker up/down to adjust scale
- Click to select, edit in properties panel

**2.6 Keyboard shortcuts**
- Space: play/pause
- J/K/L: reverse/pause/forward (standard NLE)
- Left/Right arrow: step 1 frame (1/30s)
- Shift+Left/Right: step 1 second
- Cmd+Z / Cmd+Shift+Z: undo/redo
- I: set segment in-point at playhead
- O: set segment out-point at playhead
- S: split segment at playhead
- Delete: remove selected element

### Phase 3: Properties Panel + Caption Editor (3-5 days)
*Context-sensitive controls for editing selected elements.*

**3.1 Properties panel framework**
- `components/editor/PropertiesPanel.tsx`
- Renders different content based on `selectedElement` type
- Collapsible sections within each context

**3.2 Segment properties**
- Source in/out time (editable number inputs)
- Transition type selector (hard cut, crossfade, fade)
- Playback speed (1x default, 0.5x-2x range) - stretch goal

**3.3 Caption style controls** (upgraded from current)
- Style preset picker (hormozi, minimal, karaoke, bold)
- Color pickers (primary, highlight, background)
- Font family selector
- Font size (slider, not just S/M/L)
- Position (top/center/bottom, with Y offset slider)
- Words per line
- Animation type

**3.4 Inline caption text editor**
- Shows transcript words for selected time range
- Each word editable (click to edit)
- Strike-through to hide a word
- Star/highlight toggle per word
- Changes stored in `editConfig.captionOverrides`
- Preview updates instantly

**3.5 Zoom properties**
- Scale slider (1.0 - 1.5)
- Duration slider (0.1s - 2.0s)
- Easing selector (ease in/out, ease in, linear, snap)
- Anchor point picker (visual crosshair on video preview)
- "Add zoom at playhead" button

**3.6 Global settings**
- Aspect ratio selector
- Audio normalization toggle
- Export quality settings

### Phase 4: Undo/Redo + Auto-Save + Polish (2-3 days)

**4.1 Undo/redo system**
- Zustand middleware that tracks editConfig history
- Cmd+Z / Cmd+Shift+Z
- Visual undo/redo buttons in toolbar
- History limit (50 states to avoid memory issues)

**4.2 Auto-save**
- Debounced save to Firestore on editConfig change (2 second delay)
- Save indicator in toolbar ("Saved" / "Saving..." / "Unsaved changes")
- On page unload: warn if unsaved changes

**4.3 Export flow**
- "Export" button in toolbar
- Shows export settings modal (quality, format)
- Triggers server-side render with final editConfig
- Progress indicator
- Download button when done

**4.4 Polish**
- Loading states for all async operations
- Error boundaries and recovery
- Responsive layout (minimum 1024px width for editor)
- Performance optimization (memoization, virtualized timeline for long videos)
- Smooth animations and transitions in UI

### Phase 5: Server Renderer Update (2-3 days)
*Update the Modal pipeline to consume the new editConfig format.*

**5.1 Segments-based rendering**
- Update `renderer.py` to work with segments directly (not compute from cuts)
- Extract each segment individually, then concat
- Apply per-segment transitions

**5.2 TimeMap in Python**
- Port TimeMap to Python
- Use for remapping zoom and caption timestamps
- Shared test vectors between TypeScript and Python versions

**5.3 Caption overrides**
- Read `captionOverrides` from editConfig
- Apply text corrections, hidden words, forced highlights
- Ensure rendered captions match preview exactly

**5.4 Audio crossfades**
- Apply crossfade between segments (configurable duration)
- Sound effects at transitions (optional)
- Volume normalization as final step

---

## Source Video Access Strategy

For the browser preview to work, the original source video must be streamable in the browser.

**Current:** Source video is in Firebase Storage at `raw/{uid}/{projectId}/video.mp4`. Already accessible via signed URLs. The browser can play it directly.

**Optimization:** For long videos, create an HLS (m3u8) or DASH manifest for adaptive streaming. For MVP, direct MP4 streaming is fine (Firebase Storage supports range requests).

**Caching:** Once loaded, the browser caches the video. The `<video>` element handles buffering natively. For repeat sessions, consider using the Cache API to store the video locally.

---

## Performance Considerations

### Video Seeking (Cut Playback)
When the PlaybackEngine hits a cut boundary, it needs to seek the video element. HTML5 video seeking is not instant - there's a brief delay (50-200ms) for keyframe-based seeking. Mitigations:
- Pre-buffer upcoming segments by seeking ahead during playback
- Use `fastSeek()` for approximate seeks (faster but less accurate)
- For very short segments (< 0.5s), consider pre-decoding with WebCodecs (stretch)

### CSS Transform Performance
CSS transforms (scale, translate) are GPU-accelerated and run at 60fps. The zoom preview will be smooth. Key: use `will-change: transform` on the video container.

### Caption Rendering
HTML text rendering is fast. Even with 100+ caption groups, DOM updates are negligible. Use `display: none` instead of removing elements for show/hide.

### Timeline Rendering
For videos > 5 minutes with many segments, the timeline could have hundreds of elements. Use virtualization (only render visible segments) and canvas for the waveform (stretch goal).

### Memory
Loading a full source video (e.g., 200MB for 10 minutes) uses significant memory. The browser handles this via range requests and buffering, but be aware of mobile limitations. For MVP, assume desktop-only editing (require minimum 1024px viewport).

---

## File Structure (New/Modified)

```
apps/web/src/
├── lib/
│   └── editor/
│       ├── PlaybackEngine.ts        # NEW - core playback engine
│       ├── TimeMap.ts               # NEW - timeline mapping utility
│       ├── segments.ts              # NEW - segment manipulation helpers
│       └── keyboardShortcuts.ts     # NEW - keyboard shortcut handler
├── stores/
│   └── editorStore.ts               # NEW - Zustand store for editor state
├── components/
│   └── editor/
│       ├── VideoPreview.tsx          # MODIFIED - uses PlaybackEngine instead of <video src={rendered}>
│       ├── CaptionOverlay.tsx        # NEW - HTML caption overlay synced to playback
│       ├── Timeline.tsx              # MODIFIED - complete rewrite as multi-track NLE timeline
│       ├── TimelineTrack.tsx         # NEW - generic track component
│       ├── SegmentTrack.tsx          # NEW - video segments track
│       ├── CaptionTrack.tsx          # NEW - caption blocks track
│       ├── ZoomTrack.tsx             # NEW - zoom keyframes track
│       ├── Playhead.tsx              # NEW - draggable playhead
│       ├── TimeRuler.tsx            # NEW - time ruler with markings
│       ├── PropertiesPanel.tsx       # NEW - context-sensitive properties
│       ├── CaptionEditor.tsx         # NEW - inline caption text editor
│       ├── Toolbar.tsx               # NEW - top toolbar (undo, play, export)
│       ├── ExportModal.tsx           # NEW - export settings + progress
│       ├── CaptionStylePicker.tsx    # KEPT - moved into PropertiesPanel
│       ├── ZoomControls.tsx          # KEPT - moved into PropertiesPanel
│       └── EditConfigPanel.tsx       # REMOVED - replaced by PropertiesPanel + Timeline
├── app/
│   └── (dashboard)/
│       └── editor/
│           └── [clipId]/
│               └── page.tsx          # MODIFIED - new NLE layout

processing/pipeline/
├── time_map.py                      # NEW - Python TimeMap (mirrors TypeScript)
├── renderer.py                      # MODIFIED - segments-based, fixed timestamps
├── captions.py                      # MODIFIED - supports captionOverrides
└── utils.py                         # MODIFIED - segment extraction helpers
```

---

## Migration Strategy

The NLE editor is an evolution, not a replacement. Approach:

1. **Keep the current editor working** while building the NLE
2. **Feature flag:** `useNLEEditor` in user settings or URL param `?nle=true`
3. **Gradual rollout:** NLE for new clips, old editor as fallback
4. **Data compatible:** New segments format auto-converts to/from old cuts format
5. **Server renderer accepts both:** Old editConfig (with cuts) and new editConfig (with segments)

---

## Success Metrics

- **Preview latency:** < 100ms from editConfig change to visual update (vs 2+ minutes currently)
- **Caption sync:** Captions match audio within 50ms throughout entire clip
- **Zoom accuracy:** All zoom keyframes fire at intended moments
- **Cut smoothness:** No audio pops or visual glitches at cut points
- **Export parity:** Final rendered video matches browser preview (within acceptable tolerance)
- **Edit speed:** User can make 10+ adjustments and export in under 5 minutes (vs 20+ minutes with re-render loop)

---

## Estimated Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 0: Bug fixes | 2-3 days | Working cuts, zooms, captions in current pipeline |
| Phase 1: Playback engine | 5-7 days | Real-time preview in browser, no re-rendering needed |
| Phase 2: Timeline | 5-7 days | Multi-track timeline with drag editing |
| Phase 3: Properties + captions | 3-5 days | Full editing controls for all elements |
| Phase 4: Polish | 2-3 days | Undo/redo, auto-save, export flow |
| Phase 5: Server update | 2-3 days | Updated renderer matching new editConfig |
| **Total** | **~4-5 weeks** | **Full browser-based NLE editor** |

Phase 0 and Phase 5 can partially overlap with other phases.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Video seeking latency causes gaps during cut playback | Medium | Pre-buffer next segment, use fastSeek(), add brief crossfade |
| Browser preview doesn't match final render | High | Use same TimeMap logic in both, visual regression tests |
| Large source videos cause memory issues | Medium | Desktop-only for editing, lazy loading, range requests |
| Complex FFmpeg expressions break on edge cases | Medium | Extensive test suite with real videos, fallback rendering paths |
| Timeline performance with many segments | Low | Virtualized rendering, canvas-based waveform |
| Caption styling differs HTML vs FFmpeg drawtext | Medium | Design caption styles to be achievable in both renderers |

---

## What This Enables (Future)

Once the NLE foundation exists, these features become natural extensions:

- **B-roll insertion:** Add image/video overlays on the timeline (new track type)
- **Multi-camera editing:** Multiple video tracks, switch between angles
- **Text overlays:** Title cards, lower thirds (HTML overlay, same as captions)
- **Audio tracks:** Background music, sound effects as draggable clips on audio track
- **Keyframe animation:** Animate any property over time (position, opacity, scale)
- **Templates:** Save and apply editConfig templates across clips
- **Collaborative editing:** Real-time sync via Firestore listeners (multiple users editing same clip)
- **AI re-analysis:** "Re-analyze this segment" to get new zoom/cut suggestions for a portion
