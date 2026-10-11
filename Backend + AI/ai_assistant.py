
import os
import json
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

api_key = os.getenv("OPENROUTER_API_KEY")
if not api_key:
    raise RuntimeError("OPENROUTER_API_KEY is missing from .env")

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=api_key,
)

MODEL = os.getenv("OPENROUTER_MODEL", "openrouter/free")


def interpret_disruption(message: str) -> dict:
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "Interpret railway disruption reports. "
                    "Return only valid JSON with fields: action, train_id, "
                    "delay_minutes, platform, start_minutes, end_minutes, "
                    "clarification, summary. "
                    "action must be delay, closure, or unknown. "
                    "Extract only explicitly stated details. "
                    "Preserve train IDs exactly as written, including every digit. "
                    "Never shorten, normalize, or remove digits from a train ID. "
                    "Never invent missing values. "
                    "Use null for unknown values. "
                    "Times are minutes after midnight. "
                    "Ask for clarification when required details are missing."
                ),
            },
            {"role": "user", "content": message},
        ],
        temperature=0,
    )

    content = response.choices[0].message.content
    if not content:
        raise ValueError("OpenRouter returned an empty response")

    # Some models may wrap JSON in markdown fences.
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[-1]
        content = content.rsplit("```", 1)[0].strip()

    result = json.loads(content)

    if result.get("action") not in {"delay", "closure", "unknown"}:
        raise ValueError("Unexpected action returned by AI")

    return result
