# ClipAI - AI Short-Form Video Editor

## Architecture & Implementation Guide

**Product:** AI-powered video editor that transforms raw footage into polished, ready-to-publish short-form content (TikTok, Reels, Shorts). Not a clipping tool - a full editing pipeline that replaces CapCut for creators.

**Core value prop:** Creator uploads raw talking-head video → gets back professionally edited short with auto-cuts, zooms, captions, transitions, and sound design. 2 minutes instead of 2 hours.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 14+ (App Router) + Tailwind | SSR, fast, great DX |
| Auth | Firebase Auth | Google, email, later TikTok/IG OAuth |
| Database | Firebase Firestore | Already familiar, good enough for MVP |
| File Storage | Firebase Storage | Integrated with auth rules, cheap |
| Video Processing | Python on Modal.com | Serverless GPU, pay-per-second |
| Transcription | Deepgram Nova-2 | $0.0043/min, word-level timestamps, fast |
| AI Brain | Gemini 2.5 Flash | Cheap, fast, native video understanding |
| Payments | Stripe | Checkout + Customer Portal + Webhooks |
| Hosting | Vercel | Zero-config Next.js deploy |
| Monitoring | Sentry | Error tracking frontend + backend |

### Language Split
- **TypeScript** - frontend, Firebase Cloud Functions, API routes
- **Python** - video processing pipeline only (Modal workers)

---

## Project Structure

```
clipai/
├── apps/
│   └── web/                          # Next.js frontend
│       ├── app/
│       │   ├── (auth)/
│       │   │   ├── login/
│       │   │   └── register/
│       │   ├── (dashboard)/
│       │   │   ├── projects/         # List of user projects
│       │   │   ├── project/[id]/     # Single project view + clips
│       │   │   ├── editor/[clipId]/  # Clip preview + edit controls
│       │   │   ├── publish/          # Multi-platform publish
│       │   │   ├── analytics/        # Performance dashboard (later)
│       │   │   └── settings/         # Account, billing, connected accounts
│       │   ├── layout.tsx
│       │   └── page.tsx              # Landing page
│       ├── components/
│       │   ├── upload/
│       │   │   ├── DropZone.tsx
│       │   │   ├── UploadProgress.tsx
│       │   │   └── FormatSelector.tsx
│       │   ├── editor/
│       │   │   ├── VideoPreview.tsx
│       │   │   ├── Timeline.tsx
│       │   │   ├── CaptionStylePicker.tsx
│       │   │   ├── ZoomControls.tsx
│       │   │   └── EditConfigPanel.tsx
│       │   ├── project/
│       │   │   ├── ProjectCard.tsx
│       │   │   ├── ClipCard.tsx
│       │   │   └── StatusBadge.tsx
│       │   └── shared/
│       │       ├── Navigation.tsx
│       │       ├── PricingTable.tsx
│       │       └── UsageMeter.tsx
│       ├── lib/
│       │   ├── firebase.ts           # Firebase client init
│       │   ├── firestore.ts          # DB helpers
│       │   ├── storage.ts            # Upload/download helpers
│       │   ├── stripe.ts             # Stripe client
│       │   └── hooks/
│       │       ├── useProject.ts
│       │       ├── useClips.ts
│       │       ├── useAuth.ts
│       │       └── useUsage.ts
│       └── types/
│           ├── project.ts
│           ├── clip.ts
│           ├── editConfig.ts
│           └── user.ts
│
├── functions/                        # Firebase Cloud Functions
│   ├── src/
│   │   ├── triggers/
│   │   │   ├── onVideoUpload.ts      # Storage trigger → start pipeline
│   │   │   └── onProjectUpdate.ts    # Notify user when done
│   │   ├── api/
│   │   │   ├── startProcessing.ts    # Manual re-process
│   │   │   ├── updateEditConfig.ts   # User edits → re-render
│   │   │   └── publishClip.ts       # Post to TikTok/IG/YT
│   │   ├── webhooks/
│   │   │   ├── stripe.ts            # Payment events
│   │   │   └── tiktok.ts            # Post status updates
│   │   ├── scheduled/
│   │   │   ├── cleanupStorage.ts    # Delete old raw videos
│   │   │   └── pullAnalytics.ts     # Fetch performance data (later)
│   │   └── lib/
│   │       ├── modal.ts             # Modal API client
│   │       ├── usage.ts             # Check/increment usage limits
│   │       └── notifications.ts     # Email/push notifications
│   └── package.json
│
├── processing/                       # Python - Modal.com workers
│   ├── pipeline/
│   │   ├── main.py                  # Orchestrator - runs full pipeline
│   │   ├── transcribe.py            # Deepgram integration
│   │   ├── analyze.py               # Gemini AI analysis
│   │   ├── editor.py                # Apply edit decisions
│   │   ├── captions.py              # Caption rendering
│   │   ├── renderer.py              # Final video assembly
│   │   └── utils.py                 # FFmpeg helpers
│   ├── models/
│   │   ├── edit_config.py           # Pydantic models for edit JSON
│   │   └── transcript.py            # Transcript data models
│   ├── prompts/
│   │   ├── analyze_transcript.txt   # Main analysis prompt
│   │   ├── detect_hooks.txt         # Hook detection prompt
│   │   └── suggest_zooms.txt        # Zoom point suggestions
│   ├── assets/
│   │   ├── fonts/                   # Caption fonts
│   │   ├── sounds/                  # Whoosh, boom, transitions
│   │   └── music/                   # Background tracks
│   ├── requirements.txt
│   └── modal_app.py                 # Modal deployment config
│
├── shared/                           # Shared types/constants
│   ├── types.ts
│   └── constants.ts
│
└── docs/
    ├── ARCHITECTURE.md              # This file
    ├── API.md                       # API documentation
    └── PROMPTS.md                   # AI prompt documentation
```

---

## Firestore Schema

```
// ============================================
// USERS COLLECTION
// ============================================
users/{uid}
  email: string
  displayName: string
  avatarUrl: string | null
  createdAt: timestamp
  plan: "free" | "pro" | "business"
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null

  // Connected social accounts (for publishing + analytics)
  connectedAccounts: {
    tiktok: {
      accessToken: string
      refreshToken: string
      expiresAt: timestamp
      username: string
      avatarUrl: string
    } | null
    instagram: { ... } | null
    youtube: { ... } | null
  }

  // Learned user preferences (THIS IS THE MOAT - grows over time)
  preferences: {
    defaultCaptionStyle: "hormozi" | "minimal" | "karaoke" | "bold" | "custom"
    captionColor: string           // hex
    captionFont: string
    zoomIntensity: "subtle" | "medium" | "aggressive"
    zoomStyle: "smooth" | "snap"
    preferredClipLength: number    // seconds, learned from user edits
    musicPreference: "none" | "subtle" | "energetic"
    cutStyle: "tight" | "breathing_room"
    transitionStyle: "hard_cut" | "fade" | "swipe"
  }

  // Usage tracking
  usage: {
    clipsThisMonth: number
    clipsLimit: number             // based on plan
    resetDate: timestamp
    totalClipsAllTime: number
    totalProcessingMinutes: number
  }

// ============================================
// PROJECTS COLLECTION (subcollection of users)
// ============================================
users/{uid}/projects/{projectId}
  createdAt: timestamp
  updatedAt: timestamp
  title: string                    // auto-generated or user-set
  status: "uploading" | "transcribing" | "analyzing" | "rendering" | "done" | "failed"
  failReason: string | null
  format: "talking_head" | "podcast" | "ugc" | "educational" | "entertainment"

  // Raw video metadata
  rawVideo: {
    storageUrl: string             // gs://bucket/raw/{uid}/{projectId}/video.mp4
    duration: number               // seconds
    resolution: { width: number, height: number }
    fileSize: number               // bytes
    fps: number
  }

  // Transcript (saved after step 2, so we don't re-run Deepgram)
  transcript: {
    full: string                   // complete text
    words: [
      {
        word: string
        start: number              // seconds, e.g. 0.15
        end: number
        confidence: number
        speaker: number | null     // for multi-speaker (podcast format)
      }
    ]
    language: string               // detected language
  } | null

  // AI analysis (saved after step 3, so we don't re-run Gemini)
  aiAnalysis: {
    summary: string
    hooks: [
      { start: number, end: number, text: string, score: number }  // 0-1
    ]
    deadMoments: [
      { start: number, end: number, reason: "silence" | "uhm" | "repetition" | "filler" }
    ]
    keyMoments: [
      { time: number, type: "emotional_peak" | "key_insight" | "humor" | "surprise", description: string }
    ]
    suggestedClips: [
      {
        start: number
        end: number
        title: string
        hookScore: number          // 0-1
        viralityEstimate: "low" | "medium" | "high"
        reason: string
      }
    ]
    topicSegments: [
      { start: number, end: number, topic: string }
    ]
  } | null

  // Processing metadata
  processing: {
    startedAt: timestamp | null
    completedAt: timestamp | null
    pipelineVersion: string        // "1.0.0" - for debugging
    modalJobId: string | null
    retryCount: number
    costs: {
      transcription: number        // USD
      ai: number
      rendering: number
      total: number
    }
  }

// ============================================
// CLIPS COLLECTION (subcollection of projects)
// ============================================
users/{uid}/projects/{projectId}/clips/{clipId}
  createdAt: timestamp
  updatedAt: timestamp
  status: "pending" | "rendering" | "done" | "failed"
  title: string
  order: number                    // display order

  // Source timing
  source: {
    startTime: number
    endTime: number
    duration: number
  }

  // THE EDIT CONFIG - this is the core data structure
  // AI generates it, user can modify it, renderer reads it
  editConfig: {
    // Aspect ratio
    outputRatio: "9:16" | "1:1" | "4:5"

    // Cuts - remove dead air, filler words, etc.
    cuts: [
      {
        id: string
        start: number
        end: number
        reason: "silence" | "uhm" | "repetition" | "filler" | "manual"
      }
    ]

    // Zoom keyframes
    zooms: [
      {
        id: string
        time: number               // when zoom starts
        duration: number            // how long the zoom takes
        scale: number              // 1.0 = normal, 1.15 = subtle zoom, 1.3 = aggressive
        easing: "ease_in_out" | "ease_in" | "linear" | "snap"
        anchorX: number            // 0-1, focal point
        anchorY: number            // 0-1, focal point
        reason: string             // why AI chose this moment
      }
    ]

    // Face tracking / reframing (for 16:9 → 9:16)
    reframing: {
      enabled: boolean
      mode: "face_track" | "center" | "manual"
      manualCropX: number | null   // 0-1 if manual
    }

    // Captions
    captions: {
      enabled: boolean
      style: "hormozi" | "minimal" | "karaoke" | "bold" | "outline" | "custom"
      position: "bottom" | "center" | "top"
      fontSize: "small" | "medium" | "large"
      primaryColor: string         // hex
      highlightColor: string       // hex for emphasized words
      backgroundColor: string | null
      font: string
      maxWordsPerLine: number
      animation: "word_by_word" | "line_by_line" | "fade" | "none"
      highlightKeywords: boolean   // auto-detect and color important words
      customKeywords: string[]     // user-specified words to highlight
    }

    // Transitions
    transitions: {
      intro: "none" | "fade_in" | "slide_up" | "zoom_in"
      outro: "none" | "fade_out" | "slide_down"
      betweenCuts: "hard" | "crossfade" | "swipe"
    }

    // Sound design
    audio: {
      normalizeVolume: boolean
      removeBackgroundNoise: boolean
      music: {
        enabled: boolean
        track: string | null       // track ID from assets
        volume: number             // 0-1, relative to speech
        duckOnSpeech: boolean
      }
      soundEffects: {
        enabled: boolean
        whooshOnCut: boolean
        boomOnKeyMoment: boolean
        volume: number
      }
    }

    // Overlays (later, v2+)
    overlays: {
      progressBar: boolean
      hookText: string | null       // text overlay in first 2 seconds
      ctaText: string | null        // end CTA
      watermark: { enabled: boolean, imageUrl: string | null, position: string }
    }
  }

  // Rendered output
  rendered: {
    videoUrl: string | null         // gs://bucket/rendered/{uid}/{clipId}/final.mp4
    thumbnailUrl: string | null
    duration: number
    fileSize: number
  } | null

  // Publishing status (later)
  publishing: {
    tiktok: {
      postId: string | null
      status: "draft" | "published" | "failed"
      publishedAt: timestamp | null
    } | null
    instagram: { ... } | null
    youtube: { ... } | null
  }

  // Analytics (later - pulled from platform APIs)
  analytics: {
    tiktok: {
      views: number
      likes: number
      comments: number
      shares: number
      avgWatchTime: number
      lastUpdated: timestamp
    } | null
    instagram: { ... } | null
    youtube: { ... } | null
  }
```

---

## Processing Pipeline (Python / Modal)

This is the core of the product. Every step saves its output to Firestore so the pipeline is **restartable from any point**.

```
┌─────────────────────────────────────────────────────────────┐
│                    PROCESSING PIPELINE                       │
│                                                              │
│  Input:  rawVideoUrl, format, userPreferences                │
│  Output: rendered clips in Firebase Storage                   │
│                                                              │
│  ┌──────────────┐                                            │
│  │  STEP 1      │  Download raw video from Firebase Storage  │
│  │  Download     │  Save to /tmp on Modal worker             │
│  └──────┬───────┘                                            │
│         │                                                    │
│  ┌──────▼───────┐                                            │
│  │  STEP 2      │  FFmpeg: extract audio as WAV              │
│  │  Extract      │  FFmpeg: get video metadata (fps, res)    │
│  │  Audio        │  Save: project.rawVideo metadata          │
│  └──────┬───────┘                                            │
│         │                                                    │
│  ┌──────▼───────┐                                            │
│  │  STEP 3      │  Deepgram Nova-2 API                       │
│  │  Transcribe   │  → word-level timestamps                  │
│  │               │  → speaker diarization (if podcast)       │
│  │               │  → language detection                     │
│  │               │  Save: project.transcript                 │
│  └──────┬───────┘                                            │
│         │                                                    │
│  ┌──────▼───────┐                                            │
│  │  STEP 4      │  Send to Gemini 2.5 Flash:                │
│  │  AI Analysis  │  - Full transcript with timestamps        │
│  │               │  - Video format type                      │
│  │               │  - User preferences                       │
│  │               │                                           │
│  │               │  AI returns:                              │
│  │               │  - Dead moments to cut                    │
│  │               │  - Hook candidates with scores            │
│  │               │  - Key moments for zooms                  │
│  │               │  - Suggested clip boundaries              │
│  │               │  - Keyword highlights for captions        │
│  │               │                                           │
│  │               │  Save: project.aiAnalysis                 │
│  └──────┬───────┘                                            │
│         │                                                    │
│  ┌──────▼───────┐                                            │
│  │  STEP 5      │  For each suggested clip:                  │
│  │  Generate     │  Combine AI analysis + user preferences   │
│  │  Edit Configs │  → generate complete editConfig JSON      │
│  │               │                                           │
│  │               │  Save: each clip document with editConfig │
│  └──────┬───────┘                                            │
│         │                                                    │
│  ┌──────▼───────┐                                            │
│  │  STEP 6      │  For each clip:                            │
│  │  Render       │  1. FFmpeg: extract clip segment          │
│  │               │  2. FFmpeg: apply cuts (remove dead air)  │
│  │               │  3. FFmpeg: apply zooms + reframing       │
│  │               │  4. Python/Pillow: generate caption frames│
│  │               │  5. FFmpeg: overlay captions              │
│  │               │  6. FFmpeg: add transitions               │
│  │               │  7. FFmpeg: mix audio (music, SFX)        │
│  │               │  8. FFmpeg: final encode (H.264, 1080x1920)│
│  │               │                                           │
│  │               │  Save: rendered video to Firebase Storage │
│  │               │  Save: thumbnail to Firebase Storage      │
│  │               │  Update: clip.status = "done"             │
│  └──────┬───────┘                                            │
│         │                                                    │
│  ┌──────▼───────┐                                            │
│  │  STEP 7      │  Update project.status = "done"            │
│  │  Finalize     │  Calculate processing costs               │
│  │               │  Increment user usage counter             │
│  │               │  Trigger notification to user             │
│  └──────────────┘                                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Pipeline Error Handling

```python
# Each step checks if previous output already exists
# If yes, skip to next step (idempotent restart)

async def run_pipeline(project_id: str, uid: str):
    project = get_project(uid, project_id)

    # Step 1-2: Download + extract
    if not project.get("rawVideo", {}).get("fps"):
        audio_path, metadata = extract_audio(project["rawVideo"]["storageUrl"])
        save_metadata(uid, project_id, metadata)

    # Step 3: Transcribe
    if not project.get("transcript"):
        transcript = transcribe(audio_path)
        save_transcript(uid, project_id, transcript)

    # Step 4: Analyze
    if not project.get("aiAnalysis"):
        analysis = analyze(project["transcript"], project["format"])
        save_analysis(uid, project_id, analysis)

    # Step 5-6: Generate configs + render
    for clip_suggestion in project["aiAnalysis"]["suggestedClips"]:
        clip_id = create_or_get_clip(uid, project_id, clip_suggestion)
        clip = get_clip(uid, project_id, clip_id)

        if clip["status"] != "done":
            edit_config = generate_edit_config(clip_suggestion, user_preferences)
            rendered_url = render_clip(video_path, edit_config)
            save_rendered(uid, project_id, clip_id, rendered_url)

    # Step 7: Finalize
    finalize_project(uid, project_id)
```

---

## AI Prompts

### Main Analysis Prompt (Step 4)

```
You are a professional short-form video editor AI. You analyze transcripts
of raw footage and make editing decisions.

INPUT:
- Transcript with word-level timestamps
- Video format: {format}
- Video duration: {duration}s
- Creator preferences: {preferences}

YOUR TASK:
Analyze this transcript and return a JSON object with your editing decisions.

RULES:
1. HOOKS: The first 1-3 seconds decide if someone watches. Find the strongest
   opening moments. If the video doesn't start with a hook, find a moment
   later in the video that could BE the hook (reorder).
2. DEAD AIR: Mark all silences > 0.5s, filler words (uhm, uh, like, you know),
   false starts, and repetitions for removal.
3. KEY MOMENTS: Find emotional peaks, surprising statements, humor, controversy,
   key insights. These get zoom emphasis.
4. CLIP SUGGESTIONS: Suggest 1-5 self-contained clips (30-90s each) that would
   work as standalone shorts. Each must have a clear hook → content → conclusion.
5. KEYWORDS: Identify words that should be visually highlighted in captions
   (numbers, key terms, emotional words, brand names).

OUTPUT FORMAT:
{
  "summary": "Brief description of video content",
  "hooks": [
    {
      "start": 0.0,
      "end": 3.2,
      "text": "What the person says",
      "score": 0.92,
      "reason": "Provocative question that creates curiosity gap"
    }
  ],
  "deadMoments": [
    { "start": 45.1, "end": 47.8, "reason": "silence" }
  ],
  "keyMoments": [
    {
      "time": 12.0,
      "type": "emotional_peak",
      "description": "Speaker gets passionate about X",
      "suggestedZoomScale": 1.15,
      "highlightWords": ["incredible", "changed everything"]
    }
  ],
  "suggestedClips": [
    {
      "start": 0.0,
      "end": 45.0,
      "title": "Suggested title for this clip",
      "hookScore": 0.85,
      "viralityEstimate": "high",
      "reason": "Strong hook + emotional arc + clear takeaway",
      "suggestedHookReorder": null  // or { "start": 23.5, "end": 26.1 } to move a later moment to the beginning
    }
  ],
  "topicSegments": [
    { "start": 0.0, "end": 30.0, "topic": "Introduction - the problem" }
  ]
}

TRANSCRIPT:
{transcript_with_timestamps}
```

---

## API Endpoints (Cloud Functions)

```
POST /api/projects/create
  → Creates project doc, returns upload URL for Firebase Storage
  → Checks usage limits before allowing

POST /api/projects/{id}/process
  → Triggers Modal pipeline
  → Idempotent - can re-trigger if failed

POST /api/projects/{id}/clips/{clipId}/edit
  → Updates editConfig (user made changes in editor UI)
  → Triggers re-render on Modal

POST /api/projects/{id}/clips/{clipId}/render
  → Force re-render with current editConfig
  → For when user changes caption style, zoom, etc.

POST /api/clips/{clipId}/publish
  → Publishes to selected platforms (TikTok, IG, YT)
  → Requires connected accounts

GET  /api/usage
  → Returns current usage stats and limits

POST /api/webhooks/stripe
  → Handles subscription events

POST /api/webhooks/tiktok
  → Handles post status updates
```

---

## Firebase Storage Structure

```
clipai-storage/
├── raw/{uid}/{projectId}/
│   └── video.mp4                    # Original upload (DELETE after 7 days)
│
├── audio/{uid}/{projectId}/
│   └── audio.wav                    # Extracted audio (DELETE after 24h)
│
├── rendered/{uid}/{projectId}/{clipId}/
│   ├── final.mp4                    # Rendered clip (KEEP 90 days, then Coldline)
│   └── thumbnail.jpg               # Auto-generated thumbnail
│
└── assets/
    ├── fonts/                       # Shared caption fonts
    ├── sounds/                      # Sound effects library
    └── music/                       # Background music library
```

### Storage Lifecycle Rules
- `raw/**` → Delete after 7 days
- `audio/**` → Delete after 24 hours
- `rendered/**` → Move to Coldline after 90 days
- `assets/**` → Keep forever (small, shared)

---

## Firebase Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only read/write their own data
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;

      match /projects/{projectId} {
        allow read, write: if request.auth != null && request.auth.uid == uid;

        match /clips/{clipId} {
          allow read, write: if request.auth != null && request.auth.uid == uid;
        }
      }
    }
  }
}

service firebase.storage {
  match /b/{bucket}/o {
    // Users can upload to their own raw folder
    match /raw/{uid}/{allPaths=**} {
      allow write: if request.auth != null && request.auth.uid == uid
                   && request.resource.size < 500 * 1024 * 1024  // 500MB max
                   && request.resource.contentType.matches('video/.*');
      allow read: if request.auth != null && request.auth.uid == uid;
    }

    // Users can read their own rendered clips
    match /rendered/{uid}/{allPaths=**} {
      allow read: if request.auth != null && request.auth.uid == uid;
    }

    // Cloud Functions service account handles all writes to rendered/
    // No client-side write access needed
  }
}
```

---

## Stripe Integration

### Plans

```
Free:
  - 3 clips/month
  - Watermark on output
  - Max 2 min input video
  - 720p output
  - Basic caption styles only

Pro ($19/month):
  - 30 clips/month
  - No watermark
  - Max 10 min input video
  - 1080p output
  - All caption styles
  - Sound effects
  - Priority rendering

Business ($49/month):
  - Unlimited clips
  - No watermark
  - Max 30 min input video
  - 1080p output
  - All features
  - Brand kit (custom watermark, colors, fonts)
  - Multi-platform publishing
  - Analytics dashboard
  - Priority support
```

### Webhook Flow

```
Stripe checkout.session.completed
  → Cloud Function: create/update user.plan, user.stripeCustomerId
  → Set usage.clipsLimit based on plan

Stripe customer.subscription.updated
  → Update plan level
  → Adjust limits

Stripe customer.subscription.deleted
  → Set plan = "free"
  → Set limits to free tier

Stripe invoice.payment_failed
  → Flag account, send email warning
  → After 3 failures, downgrade to free
```

---

## Environment Variables

```bash
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
FIREBASE_SERVICE_ACCOUNT_KEY=        # For Cloud Functions

# Deepgram
DEEPGRAM_API_KEY=

# Gemini
GOOGLE_AI_API_KEY=

# Modal
MODAL_TOKEN_ID=
MODAL_TOKEN_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRICE_PRO=                    # price_xxx
STRIPE_PRICE_BUSINESS=               # price_xxx

# TikTok (later)
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=

# Instagram (later)
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=

# Sentry
SENTRY_DSN=
```

---

## Implementation TODO

### Phase 1: Foundation (Week 1)

- [ ] Initialize Next.js project with TypeScript + Tailwind
- [ ] Set up Firebase project (Auth, Firestore, Storage)
- [ ] Configure Firebase security rules (Firestore + Storage)
- [ ] Create TypeScript types for all Firestore schemas (user, project, clip, editConfig)
- [ ] Implement Firebase Auth (Google sign-in + email)
- [ ] Build basic layout: navigation, auth guard, dashboard shell
- [ ] Create upload page with drag-and-drop (DropZone component)
- [ ] Implement video upload to Firebase Storage with progress tracking
- [ ] Create project document in Firestore on upload
- [ ] Set up Cloud Function trigger on video upload (onVideoUpload)
- [ ] Deploy frontend to Vercel, functions to Firebase

### Phase 2: Processing Pipeline (Week 2)

- [ ] Set up Modal.com account and Python project structure
- [ ] Write Modal deployment config (modal_app.py) with FFmpeg + dependencies
- [ ] Implement Step 1: Download video from Firebase Storage to Modal worker
- [ ] Implement Step 2: Extract audio with FFmpeg, get video metadata
- [ ] Implement Step 3: Deepgram transcription with word-level timestamps
- [ ] Save transcript to Firestore (project.transcript)
- [ ] Implement Step 4: Gemini Flash analysis with the analysis prompt
- [ ] Save AI analysis to Firestore (project.aiAnalysis)
- [ ] Implement Step 5: Generate editConfig JSON from analysis + user prefs
- [ ] Create clip documents in Firestore with editConfig
- [ ] Implement idempotent restart logic (check existing data before re-running steps)
- [ ] Wire Cloud Function → Modal API call
- [ ] Test full pipeline: upload → transcript → analysis → edit configs
- [ ] Add status updates to Firestore at each pipeline step (for frontend progress)

### Phase 3: Video Rendering (Week 3)

- [ ] Implement FFmpeg clip extraction (start/end time cut)
- [ ] Implement dead air removal (apply cuts from editConfig)
- [ ] Implement zoom/scale keyframes with FFmpeg filter_complex
- [ ] Implement face detection with MediaPipe for auto-reframing (16:9 → 9:16)
- [ ] Implement caption rendering:
  - [ ] Word-by-word timing from transcript
  - [ ] Hormozi style (word highlight, pop animation)
  - [ ] Minimal style (simple white text)
  - [ ] Karaoke style (word-by-word color fill)
  - [ ] Bold style (large, centered, shadow)
- [ ] Implement caption overlay with FFmpeg
- [ ] Implement transition effects (fade in/out, crossfade between cuts)
- [ ] Implement audio processing:
  - [ ] Volume normalization
  - [ ] Background music mixing with ducking
  - [ ] Sound effects on cuts/key moments
- [ ] Final encode: H.264, 1080x1920, optimized for mobile
- [ ] Upload rendered clips to Firebase Storage
- [ ] Generate thumbnail (best frame from hook moment)
- [ ] Update clip.status = "done" + clip.rendered in Firestore

### Phase 4: Editor UI (Week 4)

- [ ] Build project detail page (show all clips after processing)
- [ ] Build video preview player (play rendered clip)
- [ ] Build clip card component (thumbnail, title, status, actions)
- [ ] Build caption style picker (visual preview of each style)
- [ ] Build zoom intensity control (subtle/medium/aggressive)
- [ ] Build transition selector
- [ ] Build music/SFX toggle
- [ ] Implement "Apply changes" → update editConfig in Firestore → trigger re-render
- [ ] Build re-render progress indicator
- [ ] Build download button (direct link to Firebase Storage)
- [ ] Build side-by-side comparison (before/after editing)
- [ ] Handle loading states and error states throughout UI

### Phase 5: Monetization (Week 5)

- [ ] Create Stripe products and prices (Free, Pro, Business)
- [ ] Implement Stripe Checkout integration (upgrade flow)
- [ ] Implement Stripe Customer Portal (manage subscription)
- [ ] Set up Stripe webhook Cloud Function
- [ ] Implement usage tracking:
  - [ ] Increment clips counter on successful render
  - [ ] Check limits BEFORE starting pipeline (in Cloud Function, not frontend)
  - [ ] Reset counters monthly (scheduled Cloud Function)
- [ ] Build usage meter component (X/30 clips used)
- [ ] Build pricing page with plan comparison
- [ ] Implement watermark for free tier (add in rendering step)
- [ ] Implement video duration limits per plan (check before pipeline)
- [ ] Implement output resolution limits per plan (720p free, 1080p paid)
- [ ] Build upgrade prompt when user hits limit

### Phase 6: Polish & Launch (Week 6)

- [ ] Build landing page (hero, demo video, features, pricing, FAQ)
- [ ] Add Sentry error tracking (frontend + Cloud Functions)
- [ ] Implement scheduled cleanup of old raw videos (Storage lifecycle)
- [ ] Add email notifications (processing done, payment failed)
- [ ] Responsive design pass (mobile-friendly dashboard)
- [ ] Performance optimization (lazy loading, image optimization)
- [ ] SEO basics (meta tags, OG images)
- [ ] Set up analytics (Posthog or Mixpanel)
- [ ] Write onboarding flow (first upload walkthrough)
- [ ] Test end-to-end: sign up → upload → process → edit → download → pay
- [ ] Deploy production environment
- [ ] Launch

---

## Post-MVP Roadmap

### V1.1 - Platform Publishing
- [ ] TikTok OAuth integration (Login Kit)
- [ ] TikTok Content Posting API integration
- [ ] Instagram Graph API integration (Reels posting)
- [ ] YouTube Data API integration (Shorts upload)
- [ ] Multi-platform publish UI (select platforms, schedule time)
- [ ] Post status tracking via webhooks

### V1.2 - Analytics & Learning (THE MOAT)
- [ ] Pull analytics from TikTok/IG/YT APIs periodically
- [ ] Build analytics dashboard (views, likes, engagement per clip)
- [ ] Track: which editConfig decisions → which performance
- [ ] "Clone my best video" feature:
  - [ ] Analyze user's top performing clips
  - [ ] Extract patterns (hook type, zoom frequency, cut pace, caption style)
  - [ ] Apply learned patterns to new videos
- [ ] Virality prediction score based on accumulated data
- [ ] A/B testing: generate 2-3 variants of same clip, publish all, auto-kill losers

### V1.3 - Advanced Editing
- [ ] B-roll auto-insert (stock footage based on transcript keywords)
- [ ] AI-generated overlays (emoji, text callouts, arrows)
- [ ] Split-screen mode for podcast format
- [ ] Auto camera switching for multi-speaker videos
- [ ] Green screen background replacement
- [ ] AI voice enhancement / noise removal (integrate with ElevenLabs or similar)
- [ ] Custom brand kit (logo watermark, brand colors, custom fonts)

### V1.4 - Team & Collaboration
- [ ] Team workspaces (shared projects)
- [ ] Role-based access (editor, reviewer, publisher)
- [ ] Approval workflow (editor submits → manager approves → auto-publish)
- [ ] Client-facing sharing links (no login required to review)
- [ ] White-label option for agencies

---

## Cost Estimates (per video, 2 min raw input)

| Service | Cost | Notes |
|---------|------|-------|
| Deepgram transcription | $0.009 | 2 min × $0.0043/min |
| Gemini 2.5 Flash | $0.005 | ~2K input tokens, ~1K output |
| Modal GPU rendering | $0.03-0.08 | ~30-60s of GPU time |
| Firebase Storage | $0.001 | Negligible per video |
| Firebase reads/writes | $0.001 | ~20 operations |
| **Total per video** | **~$0.05-0.10** | |
| **Monthly cost at 1000 videos** | **~$50-100** | |
| **Revenue at 1000 videos (50 Pro users)** | **$950** | 50 × $19 |
| **Gross margin** | **~90%** | |

---

## Key Design Decisions & Principles

1. **editConfig as JSON is sacred.** AI generates it, user modifies it, renderer consumes it. Never hardcode rendering logic. This decouples AI decisions from video processing.

2. **Pipeline must be idempotent.** Every step saves output. If anything crashes, restart from last saved state. Never re-run Deepgram or Gemini unnecessarily.

3. **Usage limits in backend only.** Never trust the frontend for access control. Always check in Cloud Functions before starting any pipeline.

4. **User preferences grow the moat.** Every edit the user makes teaches us their style. Store everything. Over time, the default output gets closer to what they want, making switching costs high.

5. **Rendering is a black box.** The renderer takes editConfig JSON and spits out a video. Today it's FFmpeg. Tomorrow it could be Remotion, Shotstack, or a custom engine. The interface stays the same.

6. **Start with one format, do it perfectly.** Talking head → short. That's 80% of the market. Don't build podcast mode or UGC mode until talking head is flawless.

7. **Ship ugly, ship fast.** Landing page doesn't matter. Demo video doesn't matter. The 30 seconds after a user uploads their first video and sees the result matter. Optimize for that moment.
