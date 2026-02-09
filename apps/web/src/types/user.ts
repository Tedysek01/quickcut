import { Timestamp } from "firebase/firestore";

export type Plan = "free" | "pro" | "business";

export type CaptionStyle =
  | "hormozi"
  | "minimal"
  | "karaoke"
  | "bold"
  | "outline"
  | "custom";

export type ZoomIntensity = "subtle" | "medium" | "aggressive";
export type ZoomStyle = "smooth" | "snap";
export type MusicPreference = "none" | "subtle" | "energetic";
export type CutStyle = "tight" | "breathing_room";
export type TransitionStyle = "hard_cut" | "fade" | "swipe";

export interface ConnectedAccount {
  accessToken: string;
  refreshToken: string;
  expiresAt: Timestamp;
  username: string;
  avatarUrl: string;
}

export interface ConnectedAccounts {
  tiktok: ConnectedAccount | null;
  instagram: ConnectedAccount | null;
  youtube: ConnectedAccount | null;
}

export interface UserPreferences {
  defaultCaptionStyle: CaptionStyle;
  captionColor: string;
  captionFont: string;
  zoomIntensity: ZoomIntensity;
  zoomStyle: ZoomStyle;
  preferredClipLength: number;
  musicPreference: MusicPreference;
  cutStyle: CutStyle;
  transitionStyle: TransitionStyle;
}

export interface Usage {
  clipsThisMonth: number;
  clipsLimit: number;
  resetDate: Timestamp;
  totalClipsAllTime: number;
  totalProcessingMinutes: number;
}

export interface User {
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Timestamp;
  plan: Plan;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  connectedAccounts: ConnectedAccounts;
  preferences: UserPreferences;
  usage: Usage;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  defaultCaptionStyle: "hormozi",
  captionColor: "#FFFFFF",
  captionFont: "Inter",
  zoomIntensity: "medium",
  zoomStyle: "smooth",
  preferredClipLength: 60,
  musicPreference: "none",
  cutStyle: "tight",
  transitionStyle: "hard_cut",
};

export const PLAN_LIMITS: Record<Plan, { clips: number; maxDurationSeconds: number; maxFileSizeMB: number; resolution: number }> = {
  free: { clips: 3, maxDurationSeconds: 120, maxFileSizeMB: 100, resolution: 720 },
  pro: { clips: 30, maxDurationSeconds: 600, maxFileSizeMB: 500, resolution: 1080 },
  business: { clips: 9999, maxDurationSeconds: 1800, maxFileSizeMB: 500, resolution: 1080 },
};
