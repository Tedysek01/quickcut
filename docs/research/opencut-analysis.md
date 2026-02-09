# OpenCut Analysis - Co vzít pro ClipAI

**Repo:** https://github.com/OpenCut-app/OpenCut
**Typ:** Open-source CapCut alternativa (Next.js + React + TypeScript)
**Stars:** 45.7k, 90+ contributors, 1278 commits
**Datum analýzy:** 2025-02-09

---

## Co to je

Browser-based video editor s ambicí být "open-source CapCut". Na rozdíl od OmniClip (Lit + Pixi.js) je postavený na **přesně stejném stacku jako ClipAI** - Next.js, React, TypeScript, Zustand, Tailwind. To z něj dělá mnohem přímější zdroj inspirace.

### Tech stack
- **Framework:** Next.js 16 + React 19 + TypeScript 5.8
- **State:** Zustand (modulární stores)
- **Styling:** Tailwind CSS
- **Build:** Turbo monorepo, Bun runtime
- **Auth:** Better Auth
- **DB:** PostgreSQL + Redis
- **Rendering:** Canvas 2D API (OffscreenCanvas s fallbackem)
- **Export:** MediaBunny (MP4/WebM encoding)
- **Audio waveform:** WaveSurfer.js
- **Audio playback:** Web Audio API (lookahead scheduler)
- **Linting:** Biome
- **Analytics:** Databuddy

---

## Architektura

### Monorepo struktura
```
apps/
├── web/                          # Hlavní Next.js app
│   └── src/
│       ├── app/                  # Next.js App Router
│       ├── components/
│       │   ├── editor/           # Editor UI
│       │   │   ├── editor-header.tsx
│       │   │   ├── export-button.tsx
│       │   │   ├── layout-guide-overlay.tsx
│       │   │   ├── onboarding.tsx
│       │   │   ├── scenes-view.tsx
│       │   │   ├── selection-box.tsx
│       │   │   ├── dialogs/      # Modální dialogy
│       │   │   ├── panels/
│       │   │   │   ├── assets/   # Media browser
│       │   │   │   ├── preview/  # Canvas preview
│       │   │   │   │   ├── index.tsx
│       │   │   │   │   └── preview-interaction-overlay.tsx
│       │   │   │   └── properties/ # Properties panel
│       │   │   └── timeline/
│       │   │       ├── index.tsx
│       │   │       ├── timeline-playhead.tsx
│       │   │       ├── timeline-ruler.tsx
│       │   │       ├── timeline-tick.tsx
│       │   │       ├── timeline-track.tsx
│       │   │       ├── timeline-element.tsx
│       │   │       ├── audio-waveform.tsx
│       │   │       ├── drag-line.tsx
│       │   │       ├── snap-indicator.tsx
│       │   │       ├── bookmarks.tsx
│       │   │       └── timeline-toolbar.tsx
│       │   ├── landing/
│       │   ├── providers/
│       │   └── ui/
│       ├── core/                 # Business logic (Singleton pattern)
│       │   ├── index.ts          # EditorCore - centrální hub
│       │   └── managers/
│       │       ├── audio-manager.ts
│       │       ├── commands.ts       # Command pattern (undo/redo)
│       │       ├── media-manager.ts
│       │       ├── playback-manager.ts
│       │       ├── project-manager.ts
│       │       ├── renderer-manager.ts
│       │       ├── save-manager.ts
│       │       ├── scenes-manager.ts
│       │       ├── selection-manager.ts
│       │       └── timeline-manager.ts
│       ├── services/
│       │   ├── renderer/
│       │   │   ├── canvas-renderer.ts   # 2D Canvas rendering
│       │   │   ├── scene-builder.ts     # Track → Node tree
│       │   │   ├── scene-exporter.ts    # MediaBunny export
│       │   │   └── nodes/               # Render node types
│       │   │       ├── base-node.ts
│       │   │       ├── root-node.ts
│       │   │       ├── video-node.ts
│       │   │       ├── image-node.ts
│       │   │       ├── text-node.ts
│       │   │       ├── sticker-node.ts
│       │   │       ├── color-node.ts
│       │   │       ├── blur-background-node.ts
│       │   │       └── visual-node.ts
│       │   ├── storage/
│       │   ├── transcription/
│       │   │   ├── service.ts
│       │   │   └── worker.ts
│       │   └── video-cache/
│       ├── stores/                # Zustand stores
│       │   ├── editor-store.ts
│       │   ├── timeline-store.ts
│       │   ├── panel-store.ts
│       │   ├── assets-panel-store.tsx
│       │   ├── keybindings-store.ts
│       │   ├── sounds-store.ts
│       │   ├── stickers-store.ts
│       │   └── text-properties-store.ts
│       ├── types/
│       │   └── timeline.ts        # Core data model
│       ├── hooks/
│       ├── lib/
│       ├── constants/
│       └── utils/
└── tools/                         # Dev tools app
packages/                          # Shared packages
```

### EditorCore - Singleton Hub
```typescript
class EditorCore {
  static instance: EditorCore

  command: CommandManager        // Undo/redo (Command pattern)
  playback: PlaybackManager     // Play/pause/seek (rAF loop)
  timeline: TimelineManager     // Track/element CRUD
  scenes: ScenesManager         // Multi-scene support
  project: ProjectManager       // Project settings
  media: MediaManager           // Asset management
  renderer: RendererManager     // Export orchestration
  save: SaveManager             // Auto-save
  audio: AudioManager           // Web Audio playback
  selection: SelectionManager   // Selected elements

  static getInstance(): EditorCore
  static reset(): void
}
```

Všechny managers dostávají EditorCore instanci v konstruktoru → můžou volat ostatní managery skrz core. Čistá centralizace bez přímých cirkulárních závislostí.

### Data Model (types/timeline.ts)

**Track typy:** `video`, `text`, `audio`, `sticker`

```typescript
interface TTrack {
  id: string
  name: string
  type: "video" | "text" | "audio" | "sticker"
  elements: TElement[]
  isMain: boolean
  visible: boolean
}

// Base element - sdílené properties
interface TBaseElement {
  id: string
  name: string
  duration: number
  startTime: number
  trimStart: number
  trimEnd: number
}

// Transform
interface TTransform {
  scale: number
  position: { x: number, y: number }
  rotate: number
}

// Video/Image element
interface TVideoElement extends TBaseElement {
  type: "video" | "image"
  mediaId: string
  transform: TTransform
  opacity: number
}

// Text element
interface TTextElement extends TBaseElement {
  type: "text"
  content: string
  fontSize: number
  fontFamily: string
  fontWeight: string
  fontStyle: string
  color: string
  textAlign: string
  textDecoration: string
  backgroundColor?: string
}

// Audio element
interface TAudioElement extends TBaseElement {
  type: "audio" | "library-audio"
  volume: number
  muted: boolean
}

// Sticker element
interface TStickerElement extends TBaseElement {
  type: "sticker"
  icon: string
  color: string
  transform: TTransform
}
```

**Scene** = kontejner pro tracks + bookmarks:
```typescript
interface TScene {
  id: string
  name: string
  isMain: boolean
  tracks: TTrack[]
  bookmarks: TBookmark[]
}
```

### Command Pattern (Undo/Redo)

```typescript
interface Command {
  execute(): void
  undo(): void
  redo(): void
}

class CommandManager {
  history: Command[]     // undo stack
  redoStack: Command[]   // redo stack

  execute(command: Command) {
    command.execute()
    this.history.push(command)
    this.redoStack = []    // clear redo on new action
  }

  undo() {
    const cmd = this.history.pop()
    cmd.undo()
    this.redoStack.push(cmd)
  }

  redo() {
    const cmd = this.redoStack.pop()
    cmd.redo()
    this.history.push(cmd)
  }
}
```

Oproti OmniClip (celý state snapshot) → OpenCut používá granulární Command objects. Paměťově efektivnější, ale složitější na implementaci.

### Rendering Pipeline

**Scene Builder** (scene-builder.ts):
```
Tracks → filter hidden → sort z-order → create nodes

Video/Image → VideoNode/ImageNode (media, timing, trim, transform, opacity)
Text → TextNode (canvas dims, font, color, position)
Sticker → StickerNode (icon, transform, color)

Background handling:
- Blur → BlurBackgroundNode wrapping content
- Color → ColorNode + content nodes
```

**Canvas Renderer** (canvas-renderer.ts):
- `OffscreenCanvas` (fallback: `HTMLCanvasElement`)
- 2D Context (`getContext("2d")`)
- Delegační pattern: renderer → node.render() → canvas operations
- Render loop: clear black → node tree render → output

**Text Node** rendering:
- Canvas 2D `fillText()` s full typography support
- Font size scaling: `fontSize * (canvasHeight / FONT_SIZE_SCALE_REFERENCE)`
- Background rect, rotation, opacity
- Alignment, baseline, weight, style

**Export** (scene-exporter.ts):
```
SceneExporter (canvas dims, fps, format, quality)
  → CanvasRenderer renders each frame
  → CanvasSource captures canvas
  → AudioBufferSource handles audio
  → MediaBunny Output (Mp4OutputFormat / WebMOutputFormat)
  → BufferTarget → ArrayBuffer
  → Progress events (0-1)
```

### Audio System

**AudioManager** - Web Audio API s lookahead scheduler:
- Single `AudioContext` + `masterGain` node
- 2-second lookahead window, checked every 500ms
- Async iterator streams `AudioBuffer` chunks
- Buffers scheduled at precise Web Audio timestamps
- Auto-pause when buffers arrive >1 second ahead

**Audio Waveform** - WaveSurfer.js:
- `extractPeaks()` custom funkce pro sampling audio dat
- WaveSurfer config: `barWidth: 2, barGap: 1, waveColor: rgba(255,255,255,0.6)`
- Accepts URL or pre-processed AudioBuffer

### Timeline UI

**Element rendering:**
- Width: `displayedDuration * PIXELS_PER_SECOND * zoomLevel`
- Position: `displayedStartTime * 50 * zoomLevel`
- Drag: `translate3d` transform + z-30 layering
- Resize handles on selection (left/right edges)
- Context menu: split, copy, mute, hide, duplicate, delete

**Snapping & Ripple editing** toggle via timeline-store

**Playback** - `requestAnimationFrame` loop:
- `performance.now()` pro delta timing
- Custom events: `playback-seek`, `playback-update`
- Auto-pause at duration boundary

---

## Co vzít pro ClipAI

### 1. VYSOKÁ PRIORITA: EditorCore Singleton pattern

Přesně co potřebujeme. Centrální hub s typed managers, singleton access, clean separation.

**Proč je to lepší než naivní Zustand:**
- Managers mají lifecycle (init, dispose)
- Business logic je mimo React (testovatelné, reusable)
- Zustand stores jen pro UI state, core logic v managerech
- Managers volají sebe navzájem přes core bez prop drilling

**Akce pro ClipAI:** Adoptovat tento pattern 1:1. Náš EditorCore by měl:
- `PlaybackEngine` (existující z PLAN.md)
- `TimelineManager`
- `CommandManager` (undo/redo)
- `SaveManager` (auto-save to Firestore)
- `SelectionManager`
- `AudioManager` (optional, later)

### 2. VYSOKÁ PRIORITA: Command Pattern pro undo/redo

OpenCut používá granulární Command objects místo state snapshots.

| Approach | Pros | Cons |
|----------|------|------|
| **State snapshots** (OmniClip) | Jednoduché, vše je undo | Paměťově náročné, deep clone |
| **Command pattern** (OpenCut) | Paměťově efektivní, granulární | Každá operace potřebuje undo logiku |

**Akce pro ClipAI:** PLAN.md navrhuje state snapshots (jednodušší pro MVP). Ale pro produkci přejít na Command pattern. Hybridní řešení: state snapshots pro MVP → migrate na Commands ve Phase 4.

### 3. VYSOKÁ PRIORITA: Timeline komponent strukturu

OpenCut má kompletní, dobře dekomponovanou timeline. Přímo použitelné jako reference:

```
timeline/
├── index.tsx              # Container + layout
├── timeline-playhead.tsx  # Draggable playhead
├── timeline-ruler.tsx     # Time markings
├── timeline-tick.tsx      # Individual tick marks
├── timeline-track.tsx     # Track container
├── timeline-element.tsx   # Clip/element on track
├── audio-waveform.tsx     # WaveSurfer integration
├── drag-line.tsx          # Drag feedback
├── snap-indicator.tsx     # Snap-to-grid visual
├── bookmarks.tsx          # Timeline markers
└── timeline-toolbar.tsx   # Timeline controls
```

**Akce pro ClipAI:** Použít stejnou decomposition. Náš PLAN.md má Timeline.tsx jako jeden velký komponent - rozdělit podle OpenCut vzoru.

### 4. VYSOKÁ PRIORITA: Render node architektura

Scene builder pattern: tracks → node tree → canvas render. Škálovatelné pro budoucí typy obsahu.

```
BaseNode
├── RootNode (scene container)
├── VideoNode (video frames)
├── ImageNode (static images)
├── TextNode (canvas text rendering)
├── StickerNode (icons/stickers)
├── ColorNode (background colors)
├── BlurBackgroundNode (blur effect)
└── VisualNode (base for visual nodes)
```

**Akce pro ClipAI:** Pro budoucí Pixi.js/Canvas upgrade je tohle pattern. I pro HTML5+CSS MVP ale pomáhá přemýšlet v nodech: ZoomOverlayNode, CaptionOverlayNode, VideoSourceNode.

### 5. STŘEDNÍ PRIORITA: Scene builder pattern

```typescript
function buildScene(canvasSize, tracks, assets, duration, background): RootNode {
  // 1. Filter hidden tracks
  // 2. Sort z-order (bottom-to-top)
  // 3. Create typed nodes from elements
  // 4. Handle background (blur/color)
  // 5. Return RootNode tree
}
```

Čistá separace: data (tracks/elements) → render tree (nodes) → canvas output. Náš editConfig → PlaybackEngine by měl mít stejnou vrstvu.

### 6. STŘEDNÍ PRIORITA: Audio lookahead scheduler

Web Audio API pattern s 2-second lookahead. Relevantní pro:
- Background music playback v editoru
- Sound effects při transitions
- Audio preview při trimming

**Akce pro ClipAI:** Nepotřebujeme hned (Phase 1 používá HTML5 video audio), ale pro Phase 3+ (audio track, sound effects) je to reference pattern.

### 7. STŘEDNÍ PRIORITA: WaveSurfer.js integrace

Přesně jak to dělají: `extractPeaks()` custom funkce → WaveSurfer instance. Lightweight, funguje s URL i AudioBuffer.

**Akce pro ClipAI:** Timeline audio track (PLAN.md Phase 2, stretch goal). Stejný přístup - custom peak extraction, WaveSurfer vizualizace.

### 8. NÍZKÁ PRIORITA: MediaBunny pro browser export

Alternativa k WebCodecs pro browser-side export. Supports MP4 + WebM.
- npm: `mediabunny`
- Jednodušší API než raw WebCodecs
- Canvas → CanvasSource → Output → Buffer

---

## Co NEBRAT

| Technologie | Důvod |
|-------------|-------|
| **Better Auth** | Používáme Firebase Auth |
| **PostgreSQL + Redis** | Používáme Firestore |
| **Bun** | Používáme npm/Node.js |
| **Biome** | Můžeme zvážit, ale není priorita (ESLint funguje) |
| **Scenes (multi-scene)** | ClipAI zpracovává jeden clip = jeden "scene". Nepotřebujeme multi-scene |
| **Stickers** | Mimo scope pro MVP |
| **MediaBunny** | Server-side export přes Modal/FFmpeg je robustnější |

---

## Srovnání: OpenCut vs OmniClip vs ClipAI

| Aspekt | OmniClip | OpenCut | ClipAI (plán) |
|--------|----------|---------|---------------|
| **Framework** | Lit + @benev/slate | Next.js + React + Zustand | Next.js + React + Zustand |
| **Rendering** | Pixi.js (WebGL) | Canvas 2D | HTML5 + CSS (MVP) → Canvas/Pixi.js |
| **Export** | WebCodecs | MediaBunny | Server-side FFmpeg (Modal) |
| **Undo/Redo** | State snapshots | Command pattern | State snapshots → Commands |
| **Architecture** | Controllers | EditorCore Singleton + Managers | EditorCore + PlaybackEngine |
| **Transitions** | gl-transitions (WebGL) | Žádné? | gl-transitions (planned) |
| **Audio** | - | Web Audio API + WaveSurfer | HTML5 video (MVP) → Web Audio |
| **AI** | Žádné | Žádné | Gemini 2.5 Flash (core differentiator) |
| **Server** | Žádný (offline) | PostgreSQL + Redis | Firebase + Modal.com |
| **Use case** | Generic editor | Generic CapCut clone | AI-powered short-form creator |

---

## Klíčové poznatky

1. **Stejný stack = přímá reference.** Next.js + React + Zustand + TypeScript. Codebase je přímo studovatelný a adoptovatelný pro ClipAI. Tohle je "jak to udělat v Reactu" referenční implementace.

2. **EditorCore Singleton je osvědčený pattern.** Business logic mimo React, managers komunikují přes centrální hub, Zustand jen pro UI reaktivitu. Lepší než "vše v Zustand stores".

3. **Command pattern > state snapshots pro produkci.** Ale state snapshots jsou OK pro MVP (jednodušší implementace). OpenCut ukazuje cílový stav.

4. **Canvas 2D stačí.** OpenCut nepoužívá WebGL a přesto má funkční editor. Pro ClipAI MVP je HTML5+CSS preview ještě jednodušší a dostatečný.

5. **Timeline decomposition je řešitelná.** 11 komponentů, každý má jasnou zodpovědnost. Snap indicators, drag lines, bookmarks - detaily co dělají editor profesionální.

6. **Transcription je built-in.** OpenCut má vlastní transcription service (worker.ts). ClipAI používá Deepgram, ale pattern worker-based zpracování je stejný.

7. **45k stars validuje demand.** Open-source CapCut alternativa má obrovský zájem. ClipAI s AI brain je next-level nad tímhle.
