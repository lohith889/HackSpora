import os
import re
import time
import base64
import logging
from pathlib import Path
from typing import Optional, Tuple, List
import requests
from dotenv import load_dotenv

logger = logging.getLogger("sarvam_service")
logger.setLevel(logging.INFO)

# Load environment variables from project root (.env)
_ENV_PATH = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(dotenv_path=_ENV_PATH)

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
SARVAM_BASE_URL = "https://api.sarvam.ai"

# Supported language codes
SUPPORTED_LANGUAGES = {
    "en-IN": "English",
    "ta-IN": "Tamil",
    "hi-IN": "Hindi",
    "te-IN": "Telugu",
}

DEFAULT_STT_MODEL = "saaras:v3"
DEFAULT_TRANSLATION_MODEL = "mayura:v1"
DEFAULT_TTS_MODEL = "bulbul:v3"
DEFAULT_SPEAKER='Kavya'

def _get_headers() -> dict:
    key = os.getenv("SARVAM_API_KEY") or SARVAM_API_KEY
    if not key:
        raise RuntimeError("SARVAM_API_KEY is not configured in environment or .env file.")
    return {
        "api-subscription-key": key,
    }


def clean_text_for_tts(text: str) -> str:
    """Strip markdown symbols, urls, and special formatting for clean speech synthesis."""
    if not text:
        return ""
    # Remove markdown headers (###), bold/italic (*, _), bullet points, backticks
    cleaned = re.sub(r"[#*_`~]", " ", text)
    # Remove bullet symbols
    cleaned = re.sub(r"^\s*[-•+]\s*", "", cleaned, flags=re.MULTILINE)
    # Remove URLs
    cleaned = re.sub(r"https?://\S+", "", cleaned)
    # Collapse multiple whitespace / blank lines
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "recording.wav",
    language_code: Optional[str] = None
) -> Tuple[str, str]:
    """
    Transcribes audio bytes to text using Sarvam Speech-to-Text API.

    Returns:
        Tuple of (transcript_text, detected_or_used_language_code)
    """
    start_time = time.time()
    url = f"{SARVAM_BASE_URL}/speech-to-text"
    headers = _get_headers()

    data = {"model": DEFAULT_STT_MODEL}
    # Pass language code only if specified and known
    if language_code and language_code != "auto" and language_code in SUPPORTED_LANGUAGES:
        data["language_code"] = language_code

    # Map content type based on extension
    content_type = "audio/wav"
    lower_name = filename.lower()
    if lower_name.endswith(".webm"):
        content_type = "audio/webm"
    elif lower_name.endswith(".mp3"):
        content_type = "audio/mp3"
    elif lower_name.endswith(".m4a"):
        content_type = "audio/m4a"
    elif lower_name.endswith(".ogg"):
        content_type = "audio/ogg"

    files = {
        "file": (filename, audio_bytes, content_type)
    }

    try:
        response = requests.post(url, headers=headers, files=files, data=data, timeout=30)
        elapsed = time.time() - start_time

        if response.status_code != 200:
            logger.error(f"[STT Failure] Status: {response.status_code} | Body: {response.text}")
            raise RuntimeError(f"Sarvam STT failed with status {response.status_code}: {response.text}")

        res_json = response.json()
        transcript = res_json.get("transcript", "").strip()
        detected_lang = res_json.get("language_code") or language_code or "en-IN"

        logger.info(f"[STT Success] Latency: {elapsed:.2f}s | Language: {detected_lang} | Transcript length: {len(transcript)}")
        return transcript, detected_lang

    except Exception as exc:
        elapsed = time.time() - start_time
        logger.error(f"[STT Error] Latency: {elapsed:.2f}s | Error: {exc}")
        raise


def translate_to_english(
    text: str,
    source_language_code: str = "auto"
) -> Tuple[str, str]:
    """
    Translates non-English query to English (en-IN).

    Returns:
        Tuple of (english_translated_text, resolved_source_language)
    """
    clean_in = text.strip()
    if not clean_in:
        return "", source_language_code or "en-IN"

    # If explicitly English or pure ASCII without Indian scripts
    if source_language_code == "en-IN":
        return clean_in, "en-IN"

    start_time = time.time()
    url = f"{SARVAM_BASE_URL}/translate"
    headers = _get_headers()
    headers["Content-Type"] = "application/json"

    # Mayura:v1 accepts max 1000 characters
    truncated_input = clean_in[:950]

    payload = {
        "input": truncated_input,
        "source_language_code": source_language_code if source_language_code in SUPPORTED_LANGUAGES else "auto",
        "target_language_code": "en-IN",
        "model": DEFAULT_TRANSLATION_MODEL,
        "mode": "formal",
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=20)
        elapsed = time.time() - start_time

        if response.status_code != 200:
            logger.warning(f"[Translate-to-English Failure] Status: {response.status_code} | Error: {response.text}. Falling back to input.")
            return clean_in, source_language_code or "en-IN"

        res_json = response.json()
        translated = res_json.get("translated_text", "").strip() or clean_in
        detected_source = res_json.get("source_language_code") or source_language_code or "en-IN"

        logger.info(f"[Translate-to-English Success] Latency: {elapsed:.2f}s | From: {detected_source} -> en-IN")
        return translated, detected_source

    except Exception as exc:
        elapsed = time.time() - start_time
        logger.warning(f"[Translate-to-English Error] Latency: {elapsed:.2f}s | Error: {exc}. Falling back to input.")
        return clean_in, source_language_code or "en-IN"


def _chunk_text_for_translation(text: str, max_chunk_len: int = 750) -> List[str]:
    """Splits text into chunks <= max_chunk_len by paragraphs and sentences."""
    if len(text) <= max_chunk_len:
        return [text]

    chunks = []
    paragraphs = text.split("\n\n")
    current_chunk = ""

    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        if len(current_chunk) + len(p) + 2 <= max_chunk_len:
            current_chunk = f"{current_chunk}\n\n{p}" if current_chunk else p
        else:
            if current_chunk:
                chunks.append(current_chunk)
                current_chunk = ""
            if len(p) <= max_chunk_len:
                current_chunk = p
            else:
                # Split paragraph by lines or sentences
                lines = p.split("\n")
                for line in lines:
                    line = line.strip()
                    if not line:
                        continue
                    if len(current_chunk) + len(line) + 1 <= max_chunk_len:
                        current_chunk = f"{current_chunk}\n{line}" if current_chunk else line
                    else:
                        if current_chunk:
                            chunks.append(current_chunk)
                        current_chunk = line

    if current_chunk:
        chunks.append(current_chunk)

    return chunks or [text]


def translate_from_english(
    text: str,
    target_language_code: str
) -> str:
    """
    Translates English text to target language (ta-IN, hi-IN, te-IN).
    Handles chunking for responses > 900 characters.

    Returns:
        Translated text in target language, or original English on failure.
    """
    clean_in = text.strip()
    if not clean_in or target_language_code in {"en-IN", "en", ""}:
        return clean_in

    if target_language_code not in SUPPORTED_LANGUAGES:
        logger.warning(f"Unsupported target language '{target_language_code}', returning English.")
        return clean_in

    start_time = time.time()
    url = f"{SARVAM_BASE_URL}/translate"
    headers = _get_headers()
    headers["Content-Type"] = "application/json"

    chunks = _chunk_text_for_translation(clean_in, max_chunk_len=750)
    translated_pieces = []

    try:
        for idx, chunk in enumerate(chunks):
            payload = {
                "input": chunk,
                "source_language_code": "en-IN",
                "target_language_code": target_language_code,
                "model": DEFAULT_TRANSLATION_MODEL,
                "mode": "formal",
            }
            res = requests.post(url, headers=headers, json=payload, timeout=20)
            if res.status_code == 200:
                translated_part = res.json().get("translated_text", "").strip()
                translated_pieces.append(translated_part or chunk)
            else:
                logger.warning(f"[Translate-from-English Chunk {idx} Failure] Status: {res.status_code}. Using original chunk.")
                translated_pieces.append(chunk)

        elapsed = time.time() - start_time
        final_translated = "\n\n".join(translated_pieces)
        logger.info(f"[Translate-from-English Success] Latency: {elapsed:.2f}s | Target: {target_language_code} | Chunks: {len(chunks)}")
        return final_translated

    except Exception as exc:
        elapsed = time.time() - start_time
        logger.warning(f"[Translate-from-English Error] Latency: {elapsed:.2f}s | Error: {exc}. Falling back to English.")
        return clean_in


def text_to_speech(
    text: str,
    language_code: str,
    speaker: Optional[str] = DEFAULT_SPEAKER
) -> Optional[str]:
    """
    Generates spoken audio from text using Sarvam Bulbul v3 TTS.

    Returns:
        Base64-encoded WAV audio string, or None if TTS fails.
    """
    if not text:
        return None

    target_lang = language_code if language_code in SUPPORTED_LANGUAGES else "en-IN"
    start_time = time.time()
    url = f"{SARVAM_BASE_URL}/text-to-speech"
    headers = _get_headers()
    headers["Content-Type"] = "application/json"

    # Prepare clean text without markdown for natural speech
    spoken_text = clean_text_for_tts(text)
    if not spoken_text:
        return None

    # Bulbul v3 supports inputs up to 500 chars per item.
    # Take up to 2 key sentences / 450 characters for clean, responsive audio playback.
    tts_input = spoken_text[:450].strip()

    payload = {
        "inputs": [tts_input],
        "target_language_code": target_lang,
        "model": DEFAULT_TTS_MODEL,
        "enable_preprocessing": True,
        "speaker" : speaker or DEFAULT_SPEAKER,
    }
    if speaker:
        payload["speaker"] = speaker

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=25)
        elapsed = time.time() - start_time

        if response.status_code != 200:
            logger.warning(f"[TTS Failure] Status: {response.status_code} | Error: {response.text}")
            return None

        res_json = response.json()
        audios = res_json.get("audios", [])
        if audios and len(audios) > 0:
            logger.info(f"[TTS Success] Latency: {elapsed:.2f}s | Lang: {target_lang} | Audio size: {len(audios[0])} bytes")
            return audios[0]  # Base64 string

        logger.warning(f"[TTS Warning] No audio returned in response payload.")
        return None

    except Exception as exc:
        elapsed = time.time() - start_time
        logger.warning(f"[TTS Error] Latency: {elapsed:.2f}s | Error: {exc}")
        return None
