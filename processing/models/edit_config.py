from pydantic import BaseModel
from typing import List, Optional


# AI Analysis models

class Hook(BaseModel):
    start: float
    end: float
    text: str
    score: float


class DeadMoment(BaseModel):
    start: float
    end: float
    reason: str  # "silence" | "uhm" | "repetition" | "filler"


class KeyMoment(BaseModel):
    time: float
    type: str  # "emotional_peak" | "key_insight" | "humor" | "surprise"
    description: str
    suggestedZoomScale: float = 1.15
    highlightWords: List[str] = []


class SuggestedClip(BaseModel):
    start: float
    end: float
    title: str
    hookScore: float
    viralityEstimate: str  # "low" | "medium" | "high"
    reason: str
    suggestedHookReorder: Optional[dict] = None


class TopicSegment(BaseModel):
    start: float
    end: float
    topic: str


class AiAnalysis(BaseModel):
    summary: str
    hooks: List[Hook]
    deadMoments: List[DeadMoment]
    keyMoments: List[KeyMoment]
    suggestedClips: List[SuggestedClip]
    topicSegments: List[TopicSegment]


# Edit Config models

class CutConfig(BaseModel):
    id: str
    start: float
    end: float
    reason: str


class ZoomConfig(BaseModel):
    id: str
    time: float
    duration: float
    scale: float
    easing: str = "ease_in_out"
    anchorX: float = 0.5
    anchorY: float = 0.5
    reason: str = ""


class ReframingConfig(BaseModel):
    enabled: bool = True
    mode: str = "face_track"
    manualCropX: Optional[float] = None


class CaptionConfig(BaseModel):
    enabled: bool = True
    style: str = "hormozi"
    position: str = "bottom"
    fontSize: str = "medium"
    primaryColor: str = "#FFFFFF"
    highlightColor: str = "#FFD700"
    backgroundColor: Optional[str] = None
    font: str = "Inter"
    maxWordsPerLine: int = 4
    animation: str = "word_by_word"
    highlightKeywords: bool = True
    customKeywords: List[str] = []


class TransitionConfig(BaseModel):
    intro: str = "fade_in"
    outro: str = "none"
    betweenCuts: str = "hard"


class MusicConfig(BaseModel):
    enabled: bool = False
    track: Optional[str] = None
    volume: float = 0.1
    duckOnSpeech: bool = True


class SoundEffectsConfig(BaseModel):
    enabled: bool = False
    whooshOnCut: bool = False
    boomOnKeyMoment: bool = False
    volume: float = 0.3


class AudioConfig(BaseModel):
    normalizeVolume: bool = True
    removeBackgroundNoise: bool = False
    music: MusicConfig = MusicConfig()
    soundEffects: SoundEffectsConfig = SoundEffectsConfig()


class OverlayConfig(BaseModel):
    progressBar: bool = False
    hookText: Optional[str] = None
    ctaText: Optional[str] = None
    watermark: dict = {"enabled": False, "imageUrl": None, "position": "bottom_right"}


class SegmentConfig(BaseModel):
    id: str
    sourceStart: float
    sourceEnd: float
    transition: str = "none"  # "none"|"hard"|"crossfade"|"fade"|"wipe_left"|"wipe_right"|"slide_up"|"dissolve"|"zoom_in"|"circle"
    transitionDuration: float = 0.3  # seconds


class CaptionOverride(BaseModel):
    text: Optional[str] = None
    hidden: bool = False
    highlight: bool = False


class EditConfig(BaseModel):
    outputRatio: str = "9:16"
    segments: List[SegmentConfig] = []
    cuts: List[CutConfig] = []
    zooms: List[ZoomConfig] = []
    reframing: ReframingConfig = ReframingConfig()
    captions: CaptionConfig = CaptionConfig()
    transitions: TransitionConfig = TransitionConfig()
    audio: AudioConfig = AudioConfig()
    overlays: OverlayConfig = OverlayConfig()
    captionOverrides: dict = {}  # {wordIndex: CaptionOverride}
