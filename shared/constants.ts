export const PLAN_LIMITS = {
  free: { clips: 3, maxDurationSeconds: 120, maxFileSizeMB: 100, resolution: 720 },
  pro: { clips: 30, maxDurationSeconds: 600, maxFileSizeMB: 500, resolution: 1080 },
  business: { clips: 9999, maxDurationSeconds: 1800, maxFileSizeMB: 500, resolution: 1080 },
} as const;

export const PIPELINE_VERSION = "1.0.0";

export const CAPTION_STYLES = ["hormozi", "minimal", "karaoke", "bold", "outline", "custom"] as const;

export const VIDEO_FORMATS = ["talking_head", "podcast", "ugc", "educational", "entertainment"] as const;
