from __future__ import annotations

import argparse
import tempfile
from pathlib import Path

from dotenv import load_dotenv

from .audio import classify_speaker_genders, diarize, extract_audio
from .mapping import build_gender_contexts
from .srt_utils import load_srt, write_srt
from .translator import translate_all
from .video import faces_at_times


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Translate an English SRT to Hebrew using MKV for gender cues.")
    p.add_argument("--srt", required=True, help="Path to the English .srt")
    p.add_argument("--mkv", required=True, help="Path to the .mkv video")
    p.add_argument("--output", required=True, help="Path to write the Hebrew .srt")
    p.add_argument("--model", default=None, help="Claude model override")
    p.add_argument("--batch-size", type=int, default=15)
    p.add_argument("--context-window", type=int, default=3)
    return p.parse_args()


def main() -> None:
    load_dotenv()
    args = parse_args()

    subs = load_srt(args.srt)
    print(f"[1/6] loaded {len(subs)} subtitles from {args.srt}")

    with tempfile.TemporaryDirectory() as tmpdir:
        wav_path = Path(tmpdir) / "audio.wav"
        extract_audio(args.mkv, wav_path)
        print(f"[2/6] extracted audio → {wav_path}")

        segments = diarize(wav_path)
        print(f"[3/6] diarized: {len(segments)} segments, {len({s.speaker for s in segments})} speakers")

        speaker_genders = classify_speaker_genders(wav_path, segments)
        print(f"[4/6] classified speaker genders: {speaker_genders}")

    times = [s.midpoint for s in subs]
    faces_per_sub = faces_at_times(args.mkv, times)
    print(f"[5/6] detected faces for {sum(1 for f in faces_per_sub if f)}/{len(subs)} subtitles")

    contexts = build_gender_contexts(subs, segments, speaker_genders, faces_per_sub)

    translations = translate_all(
        subs,
        contexts,
        model=args.model,
        batch_size=args.batch_size,
        context_window=args.context_window,
    )
    write_srt(args.output, subs, translations)
    print(f"[6/6] wrote Hebrew SRT → {args.output}")


if __name__ == "__main__":
    main()
