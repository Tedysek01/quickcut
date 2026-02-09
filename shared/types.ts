// Shared types between frontend and Cloud Functions

export type Plan = "free" | "pro" | "business";
export type ProjectStatus = "uploading" | "transcribing" | "analyzing" | "rendering" | "done" | "failed";
export type VideoFormat = "talking_head" | "podcast" | "ugc" | "educational" | "entertainment";
export type ClipStatus = "pending" | "rendering" | "done" | "failed";
