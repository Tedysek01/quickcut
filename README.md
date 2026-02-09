# QuickCut

AI-powered short-form video editor. Upload raw footage, get back professionally edited shorts with auto-cuts, zooms, captions, transitions, and sound design. 2 minutes instead of 2 hours.

Built for creators who publish to TikTok, Instagram Reels, and YouTube Shorts.

## How It Works

```
Upload raw video → AI analyzes content → Generates edited clips → Fine-tune in browser editor → Export
```

1. **Upload** — Drag & drop one or multiple videos. They get concatenated into a single timeline.
2. **Transcribe** — Deepgram Nova-2 generates word-level timestamps with speaker diarization.
3. **AI Analysis** — Gemini 2.5 Flash identifies hooks, dead air, key moments, and suggests clip boundaries.
4. **Auto-Edit** — Pipeline generates complete edit configs: cuts, zooms, captions, transitions, sound design.
5. **Render** — FFmpeg assembles final clips on serverless GPU (Modal.com).
6. **Fine-tune** — Full NLE editor in the browser with real-time preview, undo/redo, timeline, and caption styling.

## Features

**AI Pipeline**
- Automatic dead air removal (silences, filler words, repetitions)
- Hook detection and scoring for viral potential
- Smart clip suggestions with optimal start/end points
- Keyword highlighting in captions

**Editor**
- Real-time preview with cut skipping and zoom effects
- Visual timeline with segment manipulation (split, delete, adjust edges)
- 4 caption styles: Hormozi, Minimal, Karaoke, Bold
- Word-by-word caption editing with highlight controls
- Zoom keyframe editor with easing curves
- Audio waveform visualization
- Undo/redo (50 steps)

**Video Processing**
- Multi-video concatenation
- 480p proxy workflow for fast editing
- Face tracking for 16:9 → 9:16 reframing
- Transition effects (crossfade, wipe, dissolve, zoom)
- Volume normalization and background noise removal
- Background music with speech ducking
- Sound effects on cuts and key moments

**Platform**
- Firebase Auth (Google + email)
- Stripe billing (Free / Pro / Business tiers)
- Usage tracking and limits (backend-enforced)
- Scheduled cleanup of old files

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14+ (App Router), React 19, Tailwind CSS 4 |
| State | Zustand with undo/redo |
| Auth | Firebase Auth |
| Database | Firebase Firestore |
| Storage | Firebase Storage |
| Video Processing | Python + FFmpeg on Modal.com (serverless GPU) |
| Transcription | Deepgram Nova-2 |
| AI | Gemini 2.5 Flash |
| Payments | Stripe |
| Hosting | Vercel |

## Project Structure

```
quickcut/
├── apps/web/                # Next.js frontend
│   └── src/
│       ├── app/             # Pages (auth, dashboard, editor, pricing)
│       ├── components/      # React components
│       │   ├── editor/      # VideoPreview, Timeline, CaptionEditor, ZoomControls
│       │   ├── upload/      # DropZone, UploadProgress, FormatSelector
│       │   ├── project/     # ClipCard, PipelineStepper, StatusBadge
│       │   └── shared/      # Navigation, PricingTable, UsageMeter
│       ├── lib/             # Firebase client, hooks, i18n, PlaybackEngine, TimeMap
│       ├── stores/          # Zustand editor store
│       └── types/           # TypeScript types
├── functions/               # Firebase Cloud Functions
│   └── src/
│       ├── triggers/        # onVideoUpload, onProjectUpdate
│       ├── api/             # startProcessing, updateEditConfig
│       ├── webhooks/        # Stripe webhook handler
│       └── scheduled/       # Storage cleanup
├── processing/              # Python pipeline (runs on Modal.com)
│   ├── pipeline/            # main, transcribe, analyze, renderer, captions
│   ├── models/              # Pydantic data models
│   ├── prompts/             # AI prompt templates
│   └── modal_app.py         # Modal deployment config
├── shared/                  # Shared TypeScript types & constants
└── docs/                    # Research & documentation
```

## Architecture

### The EditConfig

The core data structure. AI generates it, the user modifies it in the editor, the renderer consumes it.

```typescript
editConfig: {
  outputRatio: "9:16" | "1:1" | "4:5"
  segments: SegmentConfig[]      // parts to keep
  cuts: CutConfig[]              // parts to remove (synced)
  zooms: ZoomConfig[]            // scale keyframes with easing
  captions: CaptionConfig        // style, color, position, animation
  audio: AudioConfig             // normalization, music, SFX
  reframing: ReframingConfig     // face tracking or manual crop
  transitions: TransitionConfig  // intro, outro, between cuts
  overlays: OverlayConfig        // progress bar, hook text, CTA
}
```

### Processing Pipeline

Every step saves output to Firestore. The pipeline is idempotent — if it crashes, it restarts from the last successful step.

```
Download → Extract Audio → Transcribe (Deepgram) → Analyze (Gemini)
    → Generate Edit Configs → Render (FFmpeg) → Finalize
```

### Timing Coordinate Systems

Three coordinate spaces:
- **Source-absolute** — position in the full concatenated video
- **Clip-relative** — position within a clip (offset by `clipStart`)
- **Output** — position after cuts are applied (what the viewer sees)

The `PlaybackEngine` and `TimeMap` handle all conversions.

## Getting Started

### Prerequisites

- Node.js 22+
- Python 3.13+
- Firebase project with Auth, Firestore, and Storage enabled
- [Modal.com](https://modal.com) account
- [Deepgram](https://deepgram.com) API key
- [Google AI](https://ai.google.dev) API key (Gemini)

### Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/Tedysek01/quickcut.git
   cd quickcut
   ```

2. **Install frontend dependencies**
   ```bash
   cd apps/web
   npm install
   ```

3. **Install Cloud Functions dependencies**
   ```bash
   cd functions
   npm install
   ```

4. **Install Python dependencies**
   ```bash
   cd processing
   pip install -r requirements.txt
   ```

5. **Configure environment**

   Copy the example and fill in your keys:
   ```bash
   cp apps/web/.env.local.example apps/web/.env.local
   ```

   Required variables:
   ```env
   # Firebase
   NEXT_PUBLIC_FIREBASE_API_KEY=
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
   NEXT_PUBLIC_FIREBASE_APP_ID=

   # Stripe
   STRIPE_SECRET_KEY=
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
   STRIPE_WEBHOOK_SECRET=

   # App
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

   For the processing pipeline, see `processing/.env.example`.

6. **Run the frontend**
   ```bash
   cd apps/web
   npm run dev
   ```

7. **Deploy Cloud Functions**
   ```bash
   firebase deploy --only functions
   ```

8. **Deploy Modal pipeline**
   ```bash
   cd processing
   modal deploy modal_app.py
   ```

## Cost Per Video

For a 2-minute raw input video:

| Service | Cost |
|---------|------|
| Deepgram transcription | ~$0.009 |
| Gemini 2.5 Flash | ~$0.005 |
| Modal GPU rendering | ~$0.03–0.08 |
| Firebase Storage + ops | ~$0.002 |
| **Total** | **~$0.05–0.10** |

## License

MIT
