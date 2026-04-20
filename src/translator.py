from __future__ import annotations

import json
import os
from dataclasses import dataclass

import anthropic
from tqdm import tqdm

from .mapping import GenderContext
from .srt_utils import Subtitle


SYSTEM_PROMPT = """You are a professional subtitle translator. Your task is to translate English subtitles from a film or TV show into natural, fluent Hebrew.

Hebrew is a strongly gendered language: verbs, adjectives, pronouns, and possessives all inflect for the gender of the speaker and the gender of the addressee. English does not mark these, so you will be given explicit metadata for each line:

- speaker_gender: 'male' | 'female' | 'unknown' — the gender of the character speaking the line
- addressee_gender: 'male' | 'female' | 'unknown' — the gender of the person being addressed (when the line addresses someone in second person)

Hebrew conjugation rules you must follow:
1. First-person verbs conjugate by the SPEAKER's gender:
   - male speaker: "אני הולך", "אני רוצה", "אמרתי לך"
   - female speaker: "אני הולכת", "אני רוצה" (identical), "אמרתי לך" (identical in past 1sg)
   - Participles, adjectives, and nouns predicating the speaker still inflect: "אני עייף" (m) vs "אני עייפה" (f).
2. Second-person verbs and pronouns conjugate by the ADDRESSEE's gender:
   - addressing a man: "אתה", "שלך" (m), "בוא", "תגיד לי"
   - addressing a woman: "את", "שלך" (f — same consonants but feminine agreement on verbs), "בואי", "תגידי לי"
3. If gender metadata is 'unknown', prefer a construction that avoids gender inflection when natural (e.g. infinitive phrasing, passive, or generic plural), or use surrounding context from adjacent lines to infer gender.
4. Third-person and references to other characters should use context from adjacent lines and the content of the current line.

Additional guidelines:
- Preserve original line breaks (\\n) within a subtitle's text.
- Keep names, proper nouns, and interjections natural in Hebrew.
- Match the register (formal/informal, slang, cursing) of the source.
- Subtitles must be concise — do not add explanations or expand beyond the English meaning.
- If the English contains italics tags (<i>...</i>) or similar, preserve them around the translated text.

You will receive a batch of subtitles as a JSON array. Return a JSON object with a single key "translations" whose value is an array of objects: {"index": <int>, "hebrew": "<string>"}. The output array must contain exactly one entry per input subtitle, in the same order, with the same index values. Translate ONLY the "english" field. Do not translate the metadata fields or the context entries."""


@dataclass
class TranslationItem:
    index: int
    english: str
    speaker_gender: str
    addressee_gender: str


_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "translations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "index": {"type": "integer"},
                    "hebrew": {"type": "string"},
                },
                "required": ["index", "hebrew"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["translations"],
    "additionalProperties": False,
}


def _build_items(
    subs: list[Subtitle], contexts: list[GenderContext]
) -> list[TranslationItem]:
    return [
        TranslationItem(
            index=s.index,
            english=s.text,
            speaker_gender=c.speaker_gender,
            addressee_gender=c.addressee_gender,
        )
        for s, c in zip(subs, contexts)
    ]


def _batch_payload(
    items: list[TranslationItem],
    start: int,
    batch_size: int,
    context_window: int,
) -> tuple[list[TranslationItem], list[TranslationItem], list[TranslationItem]]:
    before = items[max(0, start - context_window) : start]
    batch = items[start : start + batch_size]
    after = items[start + batch_size : start + batch_size + context_window]
    return before, batch, after


def _item_to_dict(item: TranslationItem) -> dict:
    return {
        "index": item.index,
        "english": item.english,
        "speaker_gender": item.speaker_gender,
        "addressee_gender": item.addressee_gender,
    }


def translate_all(
    subs: list[Subtitle],
    contexts: list[GenderContext],
    *,
    model: str | None = None,
    batch_size: int = 15,
    context_window: int = 3,
    client: anthropic.Anthropic | None = None,
) -> list[str]:
    if len(subs) != len(contexts):
        raise ValueError("subs and contexts length must match")

    client = client or anthropic.Anthropic()
    model = model or os.environ.get("CLAUDE_MODEL", "claude-opus-4-7")

    items = _build_items(subs, contexts)
    translations: dict[int, str] = {}

    for start in tqdm(range(0, len(items), batch_size), desc="translating"):
        before, batch, after = _batch_payload(items, start, batch_size, context_window)

        user_payload = {
            "context_before": [_item_to_dict(it) for it in before],
            "to_translate": [_item_to_dict(it) for it in batch],
            "context_after": [_item_to_dict(it) for it in after],
        }

        response = client.messages.create(
            model=model,
            max_tokens=16000,
            thinking={"type": "adaptive"},
            output_config={
                "effort": "high",
                "format": {"type": "json_schema", "schema": _OUTPUT_SCHEMA},
            },
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Translate the subtitles in `to_translate`. Use "
                        "`context_before` and `context_after` only to inform "
                        "the translation — do not output them.\n\n"
                        + json.dumps(user_payload, ensure_ascii=False)
                    ),
                }
            ],
        )

        text = next(b.text for b in response.content if b.type == "text")
        data = json.loads(text)
        for entry in data["translations"]:
            translations[entry["index"]] = entry["hebrew"]

    missing = [s.index for s in subs if s.index not in translations]
    if missing:
        raise RuntimeError(f"missing translations for indices: {missing[:10]}...")
    return [translations[s.index] for s in subs]
