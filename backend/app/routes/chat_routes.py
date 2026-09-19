import sys
from pathlib import Path

# ─────────────────────────────────────────────────────────────
# Inject Rag_Chatbot into the Python path so we can import from
# it without restructuring the project layout.
#   chat_routes.py  → routes/ → app/ → backend/ → HackSpora/
#                                                 └── Rag_Chatbot/
# ─────────────────────────────────────────────────────────────
RAG_ROOT = Path(__file__).resolve().parents[3] / "Rag_Chatbot"
if str(RAG_ROOT) not in sys.path:
    sys.path.append(str(RAG_ROOT))

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any

# RAG pipeline imports (resolved via sys.path above)
from index import initialize_knowledge_base
from embeddings.embedding_model import load_embedding_model
from retriever.hybrid_retriever import load_hybrid_retriever
from llm.llm import load_llm
from rag.rag_chain import ask_question, clean_model_output
from retriever.reranker import CrossEncoderReranker
from utils.greetings import is_greeting, greeting_response

chat_router = APIRouter()


# ─────────────────────────────────────────────────────────────
# Multilingual & Voice RAG Router (Sarvam STT/TTS & Translation)
# ─────────────────────────────────────────────────────────────
_models = None


def _get_models():
    """Return (retriever, llm, reranker), initialising on first call."""
    global _models
    if _models is None:
        print("⏳ Initialising RAG knowledge base (first request)...")
        initialize_knowledge_base()
        embedding_model = load_embedding_model()
        retriever = load_hybrid_retriever(embedding_model)
        llm = load_llm()
        reranker = CrossEncoderReranker()
        _models = (retriever, llm, reranker)
        print("✅ RAG models ready.")
    if _models is None:
        raise RuntimeError("RAG models could not be initialised.")
    return _models


from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import base64
import traceback

from app.services.multilingual_chat_service import process_multilingual_chat

# ─────────────────────────────────────────────────────────────
# Request / Response schemas
# ─────────────────────────────────────────────────────────────

class HistoryItem(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    question: str = ""
    history: List[HistoryItem] = []
    language: Optional[str] = "en-IN"     # "en-IN", "ta-IN", "hi-IN", "te-IN", or "auto"
    enable_tts: Optional[bool] = False
    audio_data: Optional[str] = None      # Optional Base64-encoded audio if sent via JSON


class ChatResponse(BaseModel):
    answer: str
    sources: List[Dict[str, Any]] = []
    language: Optional[str] = "en-IN"
    original_query: Optional[str] = ""
    normalized_query: Optional[str] = ""
    audio: Optional[str] = None          # Base64-encoded audio (WAV) if TTS enabled


# ─────────────────────────────────────────────────────────────
# POST /api/chat (Text or Base64 Voice)
# ─────────────────────────────────────────────────────────────

@chat_router.post(
    "/chat",
    response_model=ChatResponse,
    tags=["RAG Chatbot"],
    summary="Ask a question against the agricultural schemes knowledge base (supports Multilingual & TTS)",
)
def chat(request: ChatRequest):
    """
    Accepts a user question in English, Tamil, Hindi, or Telugu.
    Translates non-English questions to English, queries the existing RAG pipeline,
    translates the answer back to the user's language, and optionally generates TTS.
    """
    audio_bytes = None
    if request.audio_data:
        try:
            # Strip data URL prefix if present (e.g. data:audio/webm;base64,...)
            raw_b64 = request.audio_data
            if "," in raw_b64:
                raw_b64 = raw_b64.split(",", 1)[1]
            audio_bytes = base64.b64decode(raw_b64)
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid audio data provided: {exc}",
            )

    if not request.question.strip() and not audio_bytes:
        raise HTTPException(
            status_code=400,
            detail="Question or voice recording cannot be empty.",
        )

    # Convert Pydantic history to plain dicts expected by ask_question()
    history = [
        {"role": item.role, "content": item.content}
        for item in request.history
    ]

    try:
        result = process_multilingual_chat(
            query_text=request.question,
            audio_bytes=audio_bytes,
            audio_filename="recording.webm",
            input_language=request.language or "en-IN",
            enable_tts=bool(request.enable_tts),
            history=history,
            rag_models_getter=_get_models,
            ask_question_func=ask_question,
            clean_model_output_func=clean_model_output,
            is_greeting_func=is_greeting,
            greeting_response_func=greeting_response,
        )

        return ChatResponse(
            answer=result["answer"],
            sources=result["sources"],
            language=result["language"],
            original_query=result["original_query"],
            normalized_query=result["normalized_query"],
            audio=result["audio"],
        )

    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"RAG chatbot processing error: {exc}",
        )


# ─────────────────────────────────────────────────────────────
# POST /api/chat/voice (Multipart Form Voice Upload)
# ─────────────────────────────────────────────────────────────

@chat_router.post(
    "/chat/voice",
    response_model=ChatResponse,
    tags=["RAG Chatbot"],
    summary="Ask a question via audio file upload (STT -> RAG -> TTS)",
)
async def chat_voice(
    file: UploadFile = File(...),
    language: str = Form("auto"),
    enable_tts: bool = Form(True),
    history: str = Form("[]"),
):
    """
    Direct voice endpoint accepting audio file uploads (.wav, .webm, .mp3, etc.).
    Uses Sarvam STT to transcribe, existing RAG to answer, and Sarvam TTS to respond.
    """
    try:
        audio_bytes = await file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read uploaded audio file: {exc}",
        )

    if not audio_bytes:
        raise HTTPException(
            status_code=400,
            detail="Audio recording was empty.",
        )

    try:
        parsed_history = json.loads(history) if history else []
    except Exception:
        parsed_history = []

    try:
        result = process_multilingual_chat(
            query_text="",
            audio_bytes=audio_bytes,
            audio_filename=file.filename or "recording.webm",
            input_language=language,
            enable_tts=enable_tts,
            history=parsed_history,
            rag_models_getter=_get_models,
            ask_question_func=ask_question,
            clean_model_output_func=clean_model_output,
            is_greeting_func=is_greeting,
            greeting_response_func=greeting_response,
        )

        return ChatResponse(
            answer=result["answer"],
            sources=result["sources"],
            language=result["language"],
            original_query=result["original_query"],
            normalized_query=result["normalized_query"],
            audio=result["audio"],
        )

    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Voice chatbot processing error: {exc}",
        )

