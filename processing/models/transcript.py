from pydantic import BaseModel
from typing import List, Optional


class Word(BaseModel):
    word: str
    start: float
    end: float
    confidence: float
    speaker: Optional[int] = None


class Transcript(BaseModel):
    full: str
    words: List[Word]
    language: str
