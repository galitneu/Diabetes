from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2


@dataclass
class Face:
    gender: str  # 'male' | 'female'
    area: float  # bbox area (pixels²) — proxy for on-screen prominence


def _grab_frame(cap: cv2.VideoCapture, t: float) -> "cv2.Mat | None":
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0)
    ok, frame = cap.read()
    return frame if ok else None


def faces_at_times(mkv_path: str | Path, times: list[float]) -> list[list[Face]]:
    """For each timestamp, return the faces visible in that frame with their
    apparent gender (via DeepFace) and bbox area. Empty list if no faces."""
    from deepface import DeepFace

    cap = cv2.VideoCapture(str(mkv_path))
    if not cap.isOpened():
        raise RuntimeError(f"could not open video: {mkv_path}")

    results: list[list[Face]] = []
    try:
        for t in times:
            frame = _grab_frame(cap, t)
            if frame is None:
                results.append([])
                continue
            try:
                analyses = DeepFace.analyze(
                    img_path=frame,
                    actions=["gender"],
                    detector_backend="opencv",
                    enforce_detection=False,
                    silent=True,
                )
            except Exception:
                results.append([])
                continue
            if isinstance(analyses, dict):
                analyses = [analyses]

            faces: list[Face] = []
            for a in analyses:
                region = a.get("region", {})
                w = float(region.get("w", 0))
                h = float(region.get("h", 0))
                if w <= 0 or h <= 0:
                    continue
                gender = a.get("dominant_gender", "").lower()
                if gender.startswith("m"):
                    g = "male"
                elif gender.startswith("w") or gender.startswith("f"):
                    g = "female"
                else:
                    continue
                faces.append(Face(gender=g, area=w * h))
            results.append(faces)
    finally:
        cap.release()
    return results
