import { Timestamp } from "firebase/firestore";
import { EditConfig } from "./editConfig";

export type ClipStatus = "pending" | "rendering" | "done" | "failed";

export interface ClipSource {
  startTime: number;
  endTime: number;
  duration: number;
}

export interface ClipRendered {
  videoUrl: string | null;
  thumbnailUrl: string | null;
  duration: number;
  fileSize: number;
}

export interface PlatformPublishStatus {
  postId: string | null;
  status: "draft" | "published" | "failed";
  publishedAt: Timestamp | null;
}

export interface ClipPublishing {
  tiktok: PlatformPublishStatus | null;
  instagram: PlatformPublishStatus | null;
  youtube: PlatformPublishStatus | null;
}

export interface PlatformAnalytics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  avgWatchTime: number;
  lastUpdated: Timestamp;
}

export interface ClipAnalytics {
  tiktok: PlatformAnalytics | null;
  instagram: PlatformAnalytics | null;
  youtube: PlatformAnalytics | null;
}

export interface Clip {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  status: ClipStatus;
  title: string;
  order: number;
  source: ClipSource;
  editConfig: EditConfig;
  rendered: ClipRendered | null;
  publishing: ClipPublishing;
  analytics: ClipAnalytics;
}
