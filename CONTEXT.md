# CONTEXT - ClipAI Development Environment

## PROJECT OVERVIEW
**ClipAI** (codename: quickcut) - AI-powered short-form video editor that transforms raw footage into polished, ready-to-publish content (TikTok, Reels, Shorts). Full editing pipeline replacing CapCut for creators.

**Core Value Prop**: Creator uploads raw talking-head video → gets back professionally edited short with auto-cuts, zooms, captions, transitions, and sound design. 2 minutes instead of 2 hours.

## SYSTEM CONTEXT
Working on MacBook Pro (Apple Silicon, arm64), macOS 26.1, hostname: MacBookPro.lan

## ENVIRONMENT SPECIFICS
- Platform: darwin arm64
- Shell: zsh
- Node.js: v22.14.0 via system install
- NPM: 11.4.1
- Python: 3.13.2
- Git: 2.48.1

## CRITICAL PATHS
- Home: /Users/mac
- Project Root: /Users/mac/Development/quickcut
- Claude Config: /Users/mac/.claude
- Architecture Doc: /Users/mac/Development/quickcut/ARCHITECTURE.md

## TECH STACK
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14+ (App Router) + Tailwind |
| Auth | Firebase Auth |
| Database | Firebase Firestore |
| File Storage | Firebase Storage |
| Video Processing | Python on Modal.com (serverless GPU) |
| Transcription | Deepgram Nova-2 |
| AI Brain | Gemini 2.5 Flash |
| Payments | Stripe |
| Hosting | Vercel |
| Monitoring | Sentry |

### Language Split
- **TypeScript** - frontend, Firebase Cloud Functions, API routes
- **Python** - video processing pipeline only (Modal workers)

## PROJECT STRUCTURE
```
clipai/
├── apps/web/                    # Next.js frontend
├── functions/                   # Firebase Cloud Functions
├── processing/                  # Python - Modal.com workers
├── shared/                      # Shared types/constants
└── docs/                        # Documentation
```

## DEVELOPMENT ENVIRONMENT
- Editor: VS Code
- Stack: Next.js + TypeScript + Tailwind | Firebase | Python + Modal | Stripe
- Git: configured for this project

## COMMAND STANDARDS
- Paths: Always absolute - /Users/mac/Development/quickcut/
- Node: npm install/run/start
- Python: python3 / pip3

## PERSONAL PREFERENCES
- Code Comments: Add helpful comments to explain complex logic, business rules, and non-obvious implementations
- File Extensions: .tsx/.jsx for React components, .ts for utilities/API, .py for processing pipeline
- Architecture Reference: Always consult ARCHITECTURE.md for schema, pipeline, and structure decisions

## CRITICAL REMINDERS
- ALWAYS use absolute paths (/Users/mac/Development/quickcut/)
- ALWAYS consult ARCHITECTURE.md before making structural decisions
- editConfig JSON is the sacred data structure - AI generates it, user modifies it, renderer consumes it
- Pipeline must be idempotent - every step saves output, restart from last saved state
- Usage limits enforced in backend only, never trust frontend
- Start with talking-head format, do it perfectly before expanding

## AGENT-FIRST WORKFLOW

### Default Operating Principle: USE AGENTS WHENEVER POSSIBLE
**Agent usage is the DEFAULT, not the exception.**

### UTILITY-FIRST MANDATE
**MANDATORY**: Utility agents must be used for ALL basic operations - no exceptions.

- **file-creator**: ALL file/directory creation tasks
- **git-workflow**: ALL git operations
- **date-checker**: ALL date/time queries
- **context-fetcher**: ALL documentation retrieval

### Agent Usage Decision Tree
```
IF utility_task (file creation, git ops, dates, doc retrieval):
  USE_UTILITY_AGENT (MANDATORY)
ELIF task_matches_specific_expertise:
  USE_SPECIALIZED_AGENT (engineering, design, marketing, etc.)
ELIF task_is_multi_domain:
  USE_MULTIPLE_AGENTS (coordinate via studio-coach if complex)
ELIF task_needs_fresh_context:
  USE_AGENT (prevents conversation context bloat)
ELSE:
  USE_GENERAL_PURPOSE_AGENT (rapid-prototyper, studio-coach)
```

### ClipAI-Specific Agent Patterns
- **Video Pipeline Work** → backend-architect + ai-engineer
- **Editor UI** → frontend-developer + ui-designer
- **Landing/Marketing Pages** → frontend-developer + growth-hacker
- **Stripe Integration** → backend-architect
- **Firebase Setup** → backend-architect + devops-automator
- **Modal Workers** → ai-engineer + backend-architect
- **Testing** → test-writer-fixer + api-tester
- **Deployment** → devops-automator + project-shipper
