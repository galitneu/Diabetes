from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
from pathlib import Path

import librosa
import numpy as np


@dataclass
class SpeakerSegment:
    start: float
    end: float
    speaker: str  # pyannote label, e.g. "SPEAKER_00"


# F0-based voice gender classification threshold (Hz). Mean speaking F0 < ~165
# Hz is typical for adult male speakers; >= 165 for adult female. This is a
# coarse heuristic — children and some voices fall outside.
_F0_THRESHOLD_HZ = 165.0


def extract_audio(mkv_path: str | Path, wav_path: str | Path, sample_rate: int = 16000) -> Path:
    wav_path = Path(wav_path)
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(mkv_path),
            "-ac", "1", "-ar", str(sample_rate),
            "-vn", "-f", "wav", str(wav_path),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return wav_path


def diarize(wav_path: str | Path, hf_token: str | None = None) -> list[SpeakerSegment]:
    from pyannote.audio import Pipeline

    token = hf_token or os.environ.get("HF_TOKEN")
    if not token:
        raise RuntimeError("HF_TOKEN is required for pyannote diarization")

    pipeline = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-3.1", use_auth_token=token
    )
    diarization = pipeline(str(wav_path))
    segments: list[SpeakerSegment] = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        segments.append(SpeakerSegment(start=turn.start, end=turn.end, speaker=speaker))
    return segments


def classify_speaker_genders(
    wav_path: str | Path, segments: list[SpeakerSegment]
) -> dict[str, str]:
    """Assign a gender ('male' | 'female' | 'unknown') per speaker label using
    mean F0 over all that speaker's segments."""
    y, sr = librosa.load(str(wav_path), sr=16000, mono=True)

    f0_by_speaker: dict[str, list[float]] = {}
    for seg in segments:
        a = int(seg.start * sr)
        b = int(seg.end * sr)
        clip = y[a:b]
        if clip.size < sr // 4:  # skip <250ms clips
            continue
        # pyin is accurate for speech F0; fmin/fmax cover typical adult range.
        f0, voiced, _ = librosa.pyin(
            clip, fmin=65.0, fmax=400.0, sr=sr, frame_length=2048
        )
        if f0 is None:
            continue
        voiced_f0 = f0[np.isfinite(f0) & voiced]
        if voiced_f0.size == 0:
            continue
        f0_by_speaker.setdefault(seg.speaker, []).append(float(np.mean(voiced_f0)))

    result: dict[str, str] = {}
    for speaker, means in f0_by_speaker.items():
        mean_f0 = float(np.mean(means))
        result[speaker] = "male" if mean_f0 < _F0_THRESHOLD_HZ else "female"
    return result


def speaker_at(segments: list[SpeakerSegment], t: float) -> str | None:
    """Return the speaker label whose segment contains time `t`, or None."""
    for seg in segments:
        if seg.start <= t <= seg.end:
            return seg.speaker
    # Fallback: nearest segment within 0.5s
    best = None
    best_dist = 0.5
    for seg in segments:
        dist = min(abs(seg.start - t), abs(seg.end - t))
        if dist < best_dist:
            best_dist = dist
            best = seg.speaker
    return best
