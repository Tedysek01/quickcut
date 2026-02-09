export type OutputRatio = "9:16" | "1:1" | "4:5";

export interface CutConfig {
  id: string;
  start: number;
  end: number;
  reason: "silence" | "uhm" | "repetition" | "filler" | "manual";
}

export interface ZoomConfig {
  id: string;
  time: number;
  duration: number;
  scale: number;
  easing: "ease_in_out" | "ease_in" | "linear" | "snap";
  anchorX: number;
  anchorY: number;
  reason: string;
}

export interface ReframingConfig {
  enabled: boolean;
  mode: "face_track" | "center" | "manual";
  manualCropX: number | null;
}

export type CaptionStyleType =
  | "hormozi"
  | "minimal"
  | "karaoke"
  | "bold"
  | "outline"
  | "custom";

export interface CaptionConfig {
  enabled: boolean;
  style: CaptionStyleType;
  position: "bottom" | "center" | "top";
  fontSize: "small" | "medium" | "large";
  primaryColor: string;
  highlightColor: string;
  backgroundColor: string | null;
  font: string;
  maxWordsPerLine: number;
  animation: "word_by_word" | "line_by_line" | "fade" | "none";
  highlightKeywords: boolean;
  customKeywords: string[];
}

export interface TransitionConfig {
  intro: "none" | "fade_in" | "slide_up" | "zoom_in";
  outro: "none" | "fade_out" | "slide_down";
  betweenCuts: "hard" | "crossfade" | "swipe";
}

export interface MusicConfig {
  enabled: boolean;
  track: string | null;
  volume: number;
  duckOnSpeech: boolean;
}

export interface SoundEffectsConfig {
  enabled: boolean;
  whooshOnCut: boolean;
  boomOnKeyMoment: boolean;
  volume: number;
}

export interface AudioConfig {
  normalizeVolume: boolean;
  removeBackgroundNoise: boolean;
  music: MusicConfig;
  soundEffects: SoundEffectsConfig;
}

export interface OverlayConfig {
  progressBar: boolean;
  hookText: string | null;
  ctaText: string | null;
  watermark: {
    enabled: boolean;
    imageUrl: string | null;
    position: string;
  };
}

export type SegmentTransition =
  | "none"
  | "hard"
  | "crossfade"
  | "fade"
  | "wipe_left"
  | "wipe_right"
  | "slide_up"
  | "dissolve"
  | "zoom_in"
  | "circle";

export interface SegmentConfig {
  id: string;
  sourceStart: number;
  sourceEnd: number;
  transition: SegmentTransition;
  transitionDuration?: number; // seconds, default 0.3
}

export interface CaptionOverride {
  text?: string;
  hidden?: boolean;
  highlight?: boolean;
}

export interface EditConfig {
  outputRatio: OutputRatio;
  segments: SegmentConfig[];
  cuts: CutConfig[];
  zooms: ZoomConfig[];
  reframing: ReframingConfig;
  captions: CaptionConfig;
  transitions: TransitionConfig;
  audio: AudioConfig;
  overlays: OverlayConfig;
  captionOverrides: Record<number, CaptionOverride>;
}
