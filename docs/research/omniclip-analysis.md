# OmniClip Analysis - Co vzít pro ClipAI

**Repo:** https://github.com/omni-media/omniclip
**Typ:** Open-source browser-based video editor (TypeScript, MIT license)
**Datum analýzy:** 2025-02-09

---

## Co to je

Plně browser-based video editor. Žádný server, vše lokálně. Rendering přes **Pixi.js (WebGL)**, encoding/decoding přes **WebCodecs API**. ~68% TypeScript, 30% JS.

### Tech stack
- **Rendering:** Pixi.js (WebGL, 1920x1080 canvas)
- **Transitions:** gl-transitions (WebGL shader-based, 600+ přechodů)
- **Audio vizualizace:** wavesurfer.js
- **Video processing:** @ffmpeg/ffmpeg (WASM), mp4box, web-demuxer
- **UI framework:** Lit (web components) + @benev/slate
- **Animace:** GSAP
- **Collaboration:** sparrow-rtc (WebRTC)
- **Storage:** OPFS (Origin Private File System)

---

## Architektura

### State Management - Historical vs Non-Historical
Elegantní split na dva typy stavu:

**historical_state** (undo/redo):
- `projectName`, `projectId`
- `tracks[]` - id, visible, locked, muted
- `effects[]` - video, audio, image, text efekty
- `filters[]`, `animations[]`, `transitions[]`

**non_historical_state** (runtime):
- Playback: `is_playing`, `timecode`, `length`, `timebase` (25fps)
- Export: `is_exporting`, `export_progress`, `export_status`, `fps`
- UI: `zoom`, `selected_effect`, `log`
- Settings: resolution (1920x1080), aspect_ratio (16/9), bitrate (9000)

### Effect System
Všechny efekty sdílí base `Effect` interface + rozšíření:

```typescript
// Base Effect
interface Effect {
  id: string
  start_at: number     // pozice na timeline (output time)
  end_at: number
  track: string        // track ID
}

// EffectRect - transformace pro vizuální efekty
interface EffectRect {
  position_x: number
  position_y: number
  width: number
  height: number
  scaleX: number
  scaleY: number
  rotation: number
  pivot_x: number
  pivot_y: number
}

// Typy efektů
VideoEffect extends Effect + { thumbnail, frames, rect: EffectRect }
AudioEffect extends Effect + { hash, duration }
ImageEffect extends Effect + { rect: EffectRect }
TextEffect extends Effect + { font, size, alignment, fill, gradients, shadow, stroke, wordWrap... }
```

### Controllers (Business Logic)
```
s/context/controllers/
├── collaboration/     # WebRTC multi-user sync
├── compositor/        # Pixi.js WebGL rendering
│   ├── controller.ts  # Main render loop
│   ├── worker.ts      # Off-main-thread rendering
│   ├── lib/           # Render utilities
│   ├── parts/         # Modular render components
│   └── utils/
├── media/             # Asset management
├── project/           # Project CRUD
├── shortcuts/         # Keyboard bindings
├── store/             # State persistence (OPFS)
├── timeline/          # Timeline logic
└── video-export/      # Export pipeline
    ├── controller.ts  # Export orchestration
    ├── bin.ts         # Encoding binary helpers
    ├── helpers/
    ├── parts/
    ├── tools/         # Encoder, decoder
    └── utils/
```

### Compositor (Renderer)
- Pixi.js Application: `new PIXI.Application({width: 1920, height: 1080, backgroundColor: "black", preference: "webgl"})`
- Frame-by-frame loop přes `requestAnimationFrame`
- Efekty se přidávají/odebírají z canvas podle timecodu
- Z-index z pořadí tracků
- Specializované managery pro každý typ efektu (video, text, audio, image)

### Export Pipeline
```
Decode → Compose → Encode → Save

1. Decoder: get_and_draw_decoded_frame(effects, timestamp)
2. Compositor: aplikuje všechny efekty na canvas
3. Encoder: encode_composed_frame(canvas, timestamp)
4. Advance: increment timestamp, seek managers
5. Repeat via requestAnimationFrame
6. save_file() po dokončení
```

### UI Components
```
s/components/
├── landingpage/      # Marketing
├── omni-anim/        # Animation controls
├── omni-filters/     # Filter panel
├── omni-manager/     # Project manager
├── omni-media/       # Media browser/import
├── omni-text/        # Text editor
├── omni-timeline/    # Timeline (tracks, playhead, drag)
│   ├── component.ts
│   ├── panel.ts
│   ├── styles.ts
│   ├── utils/
│   └── views/
└── omni-transitions/ # Transition picker
```

### Actions System
**Non-historical** (no undo): play/pause, timecode, zoom, fps, export progress, selection
**Historical** (undo/redo): add/remove effects, track ops, text formatting, transitions, animations, filters, effect transforms (position, scale, rotation)

Broadcasting system wraps actions pro multi-client sync (WebRTC collaboration).

---

## Co vzít pro ClipAI

### 1. VYSOKÁ PRIORITA: editConfig data model inspirace

Jejich `Effect` systém mapuje přímo na náš editConfig. Každý efekt má:
- `start_at` / `end_at` (timeline position)
- `track` assignment
- `EffectRect` (position, scale, rotation, pivot)
- Type-specific data

**Akce pro ClipAI:** Rozšířit editConfig schema v ARCHITECTURE.md o EffectRect-like transformace pro segmenty a zoomy. Přidat pivot point pro přesnější zoom control.

### 2. VYSOKÁ PRIORITA: gl-transitions

**Knihovna:** https://gl-transitions.com / https://github.com/gl-transitions/gl-transitions
- 600+ GPU-accelerated WebGL přechodů
- Open-source (MIT)
- OmniClip je používá přes npm `gl-transitions`
- Fungují na shader úrovni - dva framy in, jeden frame out

**Akce pro ClipAI:**
- Browser preview: integrovat přímo přes WebGL
- Server render: existují FFmpeg implementace gl-transitions (https://github.com/transitive-bullshit/ffmpeg-gl-transition)
- Nabídnout uživateli výběr transition typu per-segment (už máme v editConfig)

### 3. STŘEDNÍ PRIORITA: Historical/Non-Historical state split

Pattern pro čistý undo/redo:
- Vše co AI generuje nebo uživatel edituje → historical (undo/redo)
- Playback state, UI state, export progress → non-historical
- Zustand middleware dokáže trackovat jen historical slice

**Akce pro ClipAI:** Implementovat v editorStore.ts - už máme naplánováno v PLAN.md Phase 4, ale OmniClip ukazuje jak to strukturovat čistě.

### 4. STŘEDNÍ PRIORITA: Pixi.js compositor jako upgrade path

Náš PLAN.md počítá s HTML5 video + CSS overlays (dostatečné pro MVP). Ale OmniClip dokazuje, že Pixi.js WebGL compositor v browseru funguje pro plný rendering.

**Upgrade path pro ClipAI:**
- Phase 1-3: HTML5 + CSS (jak je v PLAN.md) - jednodušší, rychlejší
- Budoucnost: Pixi.js compositor pro pokročilé efekty (blend modes, color grading, particles, gl-transitions v preview)
- Bonus: export přímo v browseru pro rychlé drafty (WebCodecs + Pixi.js)

### 5. NÍZKÁ PRIORITA (budoucnost): WebCodecs browser export

OmniClip exportuje celé video v browseru přes WebCodecs API. Pro ClipAI to znamená:
- Quick draft export přímo v browseru (nižší kvalita, instant)
- Final export stále na serveru (Modal, plná kvalita, GPU encoding)
- Dual export: browser pro preview/draft, server pro final

### 6. REFERENČNÍ: wavesurfer.js pro audio waveform

Timeline audio track s waveform vizualizací. Stretch goal pro ClipAI Phase 2.
- npm: `wavesurfer.js`
- Lightweight, WebAudio API based
- Dobré pro vizualizaci kde jsou ticha (potvrzení AI cuts)

---

## Co NEBRAT

| Technologie | Důvod |
|-------------|-------|
| **Lit web components** | ClipAI je React/Next.js |
| **@benev/slate** state | Používáme Zustand |
| **OPFS storage** | Používáme Firebase Storage + Firestore |
| **WebRTC collaboration** | Overkill pro MVP, případně přes Firestore listeners |
| **Offline-first** | ClipAI potřebuje server-side AI (Gemini, Modal) |
| **GSAP animace** | CSS animations + Framer Motion stačí pro UI |

---

## Klíčové poznatky

1. **Browser-based video editing je production-ready.** OmniClip to dokazuje. Pixi.js + WebCodecs zvládnou i 4K.

2. **Unidirectional data flow je must-have.** State → Actions → Controllers → Components. Žádný two-way binding v editoru.

3. **Effect system je univerzální.** Stejný base interface pro video, audio, text, image. Track-based, timeline-based. Přesně co potřebujeme v editConfig.

4. **gl-transitions jsou free win.** 600+ přechodů, WebGL shader-based, fungují v browseru i FFmpeg. Okamžitě integrovat do transition pickeru.

5. **Compositor pattern je škálovatelný.** Začít jednoduše (HTML5 + CSS), upgradovat na Pixi.js když potřebujeme víc. OmniClip ukazuje cílový stav.

6. **Export pipeline je frame-by-frame loop.** Decode → compose → encode → advance. Jednoduchý a spolehlivý pattern.
