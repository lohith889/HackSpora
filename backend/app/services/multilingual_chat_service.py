import time
import logging
from typing import Optional, Dict, Any, List, Tuple
from app.services.sarvam_service import (
    transcribe_audio,
    translate_to_english,
    translate_from_english,
    text_to_speech,
    SUPPORTED_LANGUAGES,
)

logger = logging.getLogger("multilingual_chat_service")
logger.setLevel(logging.INFO)


def process_multilingual_chat(
    query_text: Optional[str] = None,
    audio_bytes: Optional[bytes] = None,
    audio_filename: str = "voice.wav",
    input_language: Optional[str] = None,
    enable_tts: bool = False,
    history: Optional[List[Dict[str, str]]] = None,
    rag_models_getter = None,
    ask_question_func = None,
    clean_model_output_func = None,
    is_greeting_func = None,
    greeting_response_func = None,
) -> Dict[str, Any]:
    """
    Multilingual orchestration layer for the Farmer Scheme RAG Chatbot.

    Pipeline:
      1. If voice -> Transcribe via Sarvam STT to obtain text + detected language.
      2. If non-English -> Translate query to English via Sarvam Translation.
      3. Call EXISTING RAG pipeline with normalized English query.
      4. If user language != English -> Translate RAG answer back to user language.
      5. If TTS requested -> Generate Sarvam Bulbul v3 spoken audio in user language.
      6. Return structured response preserving sources and metadata.
    """
    history = history or []
    target_language = input_language or "en-IN"
    if target_language not in SUPPORTED_LANGUAGES and target_language != "auto":
        target_language = "en-IN"

    original_query = ""
    resolved_language = target_language

    # ── Step 1: Voice Input (STT) ─────────────────────────────
    if audio_bytes and len(audio_bytes) > 0:
        logger.info(f"[Multilingual Chat] Processing voice input ({len(audio_bytes)} bytes), hint language: {target_language}")
        try:
            transcript, detected_lang = transcribe_audio(
                audio_bytes=audio_bytes,
                filename=audio_filename,
                language_code=target_language if target_language != "auto" else None,
            )
            original_query = transcript
            resolved_language = detected_lang if detected_lang in SUPPORTED_LANGUAGES else "en-IN"
            logger.info(f"[Voice STT Completed] Transcript: '{original_query[:60]}...' | Language: {resolved_language}")
        except Exception as exc:
            logger.error(f"[Voice STT Failed] {exc}")
            raise RuntimeError(f"Voice transcription failed: {exc}")
    else:
        original_query = (query_text or "").strip()

    if not original_query:
        return {
            "language": resolved_language,
            "original_query": "",
            "normalized_query": "",
            "answer": "Please ask a question about agricultural schemes.",
            "audio": None,
            "sources": [],
        }

    # ── Step 2: Language Normalization (Translate to English) ──
    normalized_query = original_query
    if resolved_language != "en-IN" or target_language == "auto":
        logger.info(f"[Translate Query] Translating '{original_query[:50]}' from {resolved_language} to en-IN")
        try:
            normalized_query, detected_src = translate_to_english(
                text=original_query,
                source_language_code=resolved_language if resolved_language != "auto" else "auto"
            )
            if detected_src in SUPPORTED_LANGUAGES:
                resolved_language = detected_src
        except Exception as exc:
            logger.warning(f"[Translate Query Failed] {exc}. Proceeding with original query.")
            normalized_query = original_query

    logger.info(f"[Query Normalized] Original ({resolved_language}): '{original_query}' -> English: '{normalized_query}'")

    # ── Fast Greeting Check ────────────────────────────────────
    if is_greeting_func and is_greeting_func(normalized_query):
        greeting_en = greeting_response_func(normalized_query) if greeting_response_func else "Namaste! How can I assist you with agricultural schemes?"
        final_greeting = greeting_en
        if resolved_language != "en-IN":
            try:
                final_greeting = translate_from_english(greeting_en, resolved_language)
            except Exception:
                final_greeting = greeting_en

        audio_base64 = None
        if enable_tts:
            audio_base64 = text_to_speech(final_greeting, resolved_language)

        return {
            "language": resolved_language,
            "original_query": original_query,
            "normalized_query": normalized_query,
            "answer": final_greeting,
            "audio": audio_base64,
            "sources": [],
        }

    # ── Step 3: Call Existing RAG Pipeline (English Only) ──────
    rag_start = time.time()
    english_answer = ""
    sources = []

    try:
        retriever, llm, reranker = rag_models_getter()

        for result in ask_question_func(
            normalized_query,
            history,
            retriever,
            llm,
            reranker,
        ):
            if result["type"] == "text":
                english_answer += result["content"]
            elif result["type"] == "sources":
                sources = result["content"]

        if clean_model_output_func:
            english_answer = clean_model_output_func(english_answer)

        rag_latency = time.time() - rag_start
        logger.info(f"[RAG Latency] {rag_latency:.2f}s | Chunks retrieved | Answer length: {len(english_answer)}")

    except Exception as exc:
        rag_latency = time.time() - rag_start
        logger.error(f"[RAG Execution Error] Latency: {rag_latency:.2f}s | Error: {exc}")
        raise

    # ── Step 4: Translate Answer Back to User's Language ───────
    final_answer = english_answer
    if resolved_language != "en-IN":
        logger.info(f"[Translate Answer] Translating answer to {resolved_language}")
        try:
            final_answer = translate_from_english(
                text=english_answer,
                target_language_code=resolved_language
            )
        except Exception as exc:
            logger.warning(f"[Translate Answer Failed] {exc}. Falling back to English answer.")
            final_answer = english_answer

    # ── Step 5: Text-to-Speech (Optional) ──────────────────────
    audio_base64 = None
    if enable_tts and final_answer:
        logger.info(f"[TTS Generation] Generating speech in {resolved_language}")
        try:
            audio_base64 = text_to_speech(final_answer, resolved_language)
        except Exception as exc:
            logger.warning(f"[TTS Generation Failed] {exc}. Continuing with text response.")
            audio_base64 = None

    return {
        "language": resolved_language,
        "original_query": original_query,
        "normalized_query": normalized_query,
        "answer": final_answer,
        "audio": audio_base64,
        "sources": sources,
    }
