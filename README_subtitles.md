# Hebrew Subtitle Translator

Translates an English `.srt` to Hebrew using an `.mkv` video as the source of
gender cues (speaker from audio, addressee from on-screen faces), so Hebrew
verbs and pronouns conjugate correctly.

## Pipeline

1. Parse the input `.srt`.
2. Extract audio from the `.mkv` with `ffmpeg`.
3. Run speaker diarization (`pyannote.audio`) → per-segment speaker IDs.
4. Classify each speaker's gender from voice pitch (F0 via librosa).
5. For each subtitle, sample a video frame at its midpoint, detect faces and
   their apparent gender (DeepFace).
6. Map each subtitle to `speaker_gender` (from active diarization segment) and
   `addressee_gender` (most prominent visible face whose gender differs from
   the speaker, else `unknown`).
7. Batch-translate with Claude (prompt-cached system prompt + structured JSON
   output), passing the gender metadata.
8. Write the Hebrew `.srt`.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env  # fill in ANTHROPIC_API_KEY and HF_TOKEN
```

`HF_TOKEN` is needed to download `pyannote/speaker-diarization-3.1`; accept the
model's terms on Hugging Face first. `ffmpeg` must be on `PATH`.

## Usage

```bash
python -m src.main --srt input.en.srt --mkv movie.mkv --output input.he.srt
```

## Limits

- Addressee detection is heuristic. When multiple faces of different genders
  are visible, the top-scored "not the speaker" face is picked; in ambiguous
  scenes the model falls back to `unknown` and Claude uses surrounding context.
- DeepFace's gender model infers apparent gender from face image — this is an
  imperfect proxy. Users can override per-scene via a manual map (not yet
  implemented).
