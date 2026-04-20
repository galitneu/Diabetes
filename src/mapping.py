from __future__ import annotations

from dataclasses import dataclass

from .audio import SpeakerSegment, speaker_at
from .srt_utils import Subtitle
from .video import Face


@dataclass
class GenderContext:
    speaker_gender: str  # 'male' | 'female' | 'unknown'
    addressee_gender: str


def _addressee_from_faces(faces: list[Face], speaker_gender: str) -> str:
    if not faces:
        return "unknown"
    # Prefer the largest face whose gender differs from the speaker; the
    # assumption is that the speaker is either off-screen or their face isn't
    # the on-screen conversational partner.
    if speaker_gender in ("male", "female"):
        opposite = [f for f in faces if f.gender != speaker_gender]
        if opposite:
            return max(opposite, key=lambda f: f.area).gender
    # Fall back to the most prominent face overall.
    return max(faces, key=lambda f: f.area).gender


def build_gender_contexts(
    subs: list[Subtitle],
    segments: list[SpeakerSegment],
    speaker_genders: dict[str, str],
    faces_per_sub: list[list[Face]],
) -> list[GenderContext]:
    if len(subs) != len(faces_per_sub):
        raise ValueError("subs and faces_per_sub length must match")
    contexts: list[GenderContext] = []
    for sub, faces in zip(subs, faces_per_sub):
        speaker = speaker_at(segments, sub.midpoint)
        speaker_gender = speaker_genders.get(speaker, "unknown") if speaker else "unknown"
        addressee_gender = _addressee_from_faces(faces, speaker_gender)
        contexts.append(
            GenderContext(
                speaker_gender=speaker_gender,
                addressee_gender=addressee_gender,
            )
        )
    return contexts
