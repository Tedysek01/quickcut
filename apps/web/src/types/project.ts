import { Timestamp } from "firebase/firestore";

export type ProjectStatus =
  | "uploading"
  | "uploaded"
  | "transcribing"
  | "analyzing"
  | "rendering"
  | "done"
  | "failed";

export type VideoFormat =
  | "talking_head"
  | "podcast"
  | "ugc"
  | "educational"
  | "entertainment";

export type VideoLanguage =
  | "cs"
  | "en"
  | "de"
  | "es"
  | "fr"
  | "pl"
  | "pt"
  | "it"
  | "nl"
  | "sv"
  | "ja"
  | "ko"
  | "zh";

export interface RawVideo {
  storageUrl: string;
  duration: number;
  resolution: { width: number; height: number };
  fileSize: number;
  fps: number;
}

export interface SourceVideo {
  id: string;
  originalName: string;
  storageUrl: string;
  duration: number;
  fileSize: number;
  order: number;
  offsetInTimeline: number;
}

export interface Word {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker: number | null;
}

export interface Transcript {
  full: string;
  words: Word[];
  language: string;
}

export interface Hook {
  start: number;
  end: number;
  text: string;
  score: number;
}

export interface DeadMoment {
  start: number;
  end: number;
  reason: "silence" | "uhm" | "repetition" | "filler";
}

export interface KeyMoment {
  time: number;
  type: "emotional_peak" | "key_insight" | "humor" | "surprise";
  description: string;
}

export interface SuggestedClip {
  start: number;
  end: number;
  title: string;
  hookScore: number;
  viralityEstimate: "low" | "medium" | "high";
  reason: string;
}

export interface TopicSegment {
  start: number;
  end: number;
  topic: string;
}

export interface AiAnalysis {
  summary: string;
  hooks: Hook[];
  deadMoments: DeadMoment[];
  keyMoments: KeyMoment[];
  suggestedClips: SuggestedClip[];
  topicSegments: TopicSegment[];
}

export interface ProcessingCosts {
  transcription: number;
  ai: number;
  rendering: number;
  total: number;
}

export interface ProcessingMetadata {
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
  pipelineVersion: string;
  modalJobId: string | null;
  retryCount: number;
  costs: ProcessingCosts;
}

export interface Project {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  title: string;
  status: ProjectStatus;
  failReason: string | null;
  format: VideoFormat;
  language: VideoLanguage;
  rawVideo: RawVideo;
  sourceVideos: SourceVideo[];
  proxyUrl: string | null;
  proxyStatus: "none" | "generating" | "ready";
  transcript: Transcript | null;
  aiAnalysis: AiAnalysis | null;
  processing: ProcessingMetadata;
}
