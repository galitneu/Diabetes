from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import srt


@dataclass
class Subtitle:
    index: int
    start: float  # seconds
    end: float
    text: str

    @property
    def midpoint(self) -> float:
        return (self.start + self.end) / 2.0


def load_srt(path: str | Path) -> list[Subtitle]:
    raw = Path(path).read_text(encoding="utf-8")
    return [
        Subtitle(
            index=s.index,
            start=s.start.total_seconds(),
            end=s.end.total_seconds(),
            text=s.content,
        )
        for s in srt.parse(raw)
    ]


def write_srt(path: str | Path, subs: list[Subtitle], translations: list[str]) -> None:
    if len(subs) != len(translations):
        raise ValueError(f"subs/translations length mismatch: {len(subs)} vs {len(translations)}")
    from datetime import timedelta

    items = [
        srt.Subtitle(
            index=sub.index,
            start=timedelta(seconds=sub.start),
            end=timedelta(seconds=sub.end),
            content=text,
        )
        for sub, text in zip(subs, translations)
    ]
    Path(path).write_text(srt.compose(items), encoding="utf-8")
