from deepgram import DeepgramClient
from models.transcript import Transcript, Word


def transcribe(audio_path: str, language: str = "en", diarize: bool = False) -> Transcript:
    """Transcribe audio using Deepgram Nova-2."""
    client = DeepgramClient()

    with open(audio_path, "rb") as f:
        buffer = f.read()

    response = client.listen.v1.media.transcribe_file(
        request=buffer,
        model="nova-2",
        smart_format=True,
        punctuate=True,
        diarize=diarize,
        utterances=True,
        language=language,
    )

    # Access response via attributes (Deepgram SDK v5)
    channels = response.results.channels
    if not channels:
        raise ValueError("No transcription results returned")

    alternatives = channels[0].alternatives
    if not alternatives:
        raise ValueError("No transcription alternatives returned")

    full_text = alternatives[0].transcript or ""

    # Extract word-level data
    words = []
    for w in alternatives[0].words:
        # Speaker field only exists when diarization is enabled
        try:
            speaker_val = w.speaker
        except Exception:
            speaker_val = None
        try:
            conf_val = round(w.confidence, 3)
        except Exception:
            conf_val = 0.0
        words.append(Word(
            word=w.word,
            start=round(w.start, 2),
            end=round(w.end, 2),
            confidence=conf_val,
            speaker=speaker_val,
        ))

    # Detect language
    detected_language = channels[0].detected_language or "en"

    return Transcript(
        full=full_text,
        words=words,
        language=detected_language,
    )
