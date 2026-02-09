import os
import json
from google import genai
from google.genai import types
from models.transcript import Transcript
from models.edit_config import AiAnalysis


ANALYSIS_PROMPT = """You are a professional short-form video editor AI. You analyze transcripts of raw footage and make editing decisions.

INPUT:
- Transcript with word-level timestamps
- Video format: {format}
- Video duration: {duration}s
- Creator preferences: {preferences}

YOUR TASK:
Analyze this transcript and return a JSON object with your editing decisions.

RULES:
1. HOOKS: The first 1-3 seconds decide if someone watches. Find the strongest opening moments. If the video doesn't start with a hook, find a moment later in the video that could BE the hook (reorder).
2. DEAD AIR: Mark all silences > 0.5s, filler words (um, uh, like, you know, basically, right, so yeah), false starts, and repetitions for removal.
3. KEY MOMENTS: Find emotional peaks, surprising statements, humor, controversy, key insights. These get zoom emphasis.
4. CLIP SUGGESTIONS: Suggest 1-5 self-contained clips (30-90s each) that would work as standalone shorts. Each must have a clear hook → content → conclusion.
5. KEYWORDS: Identify words that should be visually highlighted in captions (numbers, key terms, emotional words, brand names).

OUTPUT FORMAT (return ONLY valid JSON, no markdown):
{{
  "summary": "Brief description of video content",
  "hooks": [
    {{
      "start": 0.0,
      "end": 3.2,
      "text": "What the person says",
      "score": 0.92
    }}
  ],
  "deadMoments": [
    {{ "start": 45.1, "end": 47.8, "reason": "silence" }}
  ],
  "keyMoments": [
    {{
      "time": 12.0,
      "type": "emotional_peak",
      "description": "Speaker gets passionate about X",
      "suggestedZoomScale": 1.15,
      "highlightWords": ["incredible", "changed everything"]
    }}
  ],
  "suggestedClips": [
    {{
      "start": 0.0,
      "end": 45.0,
      "title": "Suggested title for this clip",
      "hookScore": 0.85,
      "viralityEstimate": "high",
      "reason": "Strong hook + emotional arc + clear takeaway"
    }}
  ],
  "topicSegments": [
    {{ "start": 0.0, "end": 30.0, "topic": "Introduction - the problem" }}
  ]
}}

TRANSCRIPT:
{transcript}"""


def analyze_transcript(
    transcript: Transcript,
    format: str,
    duration: float,
    preferences: dict,
) -> AiAnalysis:
    """Analyze transcript using Gemini 3 Flash to get editing decisions."""
    api_key = os.environ.get("GOOGLE_AI_API_KEY", "")
    client = genai.Client(api_key=api_key)

    # Build transcript with timestamps
    transcript_text = ""
    for word in transcript.words:
        transcript_text += f"[{word.start:.2f}] {word.word} "

    prompt = ANALYSIS_PROMPT.format(
        format=format,
        duration=f"{duration:.1f}",
        preferences=json.dumps(preferences),
        transcript=transcript_text.strip(),
    )

    # Call Gemini 3 Flash
    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=prompt,
        config=types.GenerateContentConfig(
            max_output_tokens=4096,
            response_mime_type="application/json",
            thinking_config=types.ThinkingConfig(thinking_level="low"),
        ),
    )

    response_text = response.text.strip()

    # Parse JSON
    try:
        data = json.loads(response_text)
    except json.JSONDecodeError:
        # Retry with explicit JSON instruction
        retry_response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=f"The previous response was not valid JSON. Please return ONLY valid JSON.\n\n{prompt}",
            config=types.GenerateContentConfig(
                max_output_tokens=4096,
                response_mime_type="application/json",
                thinking_config=types.ThinkingConfig(thinking_level="low"),
            ),
        )
        data = json.loads(retry_response.text.strip())

    return AiAnalysis(**data)
