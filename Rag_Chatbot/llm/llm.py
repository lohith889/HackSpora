
'''
from langchain_ollama import ChatOllama


def load_llm():

    return ChatOllama(
        model="qwen3.5:9b",
        temperature=0
    )
'''

import os
from pathlib import Path

from dotenv import load_dotenv
from langchain_groq import ChatGroq
from config import LLM_MODEL

# Load .env from HackSpora root (two levels up from Rag_Chatbot/llm/)
# This works whether the module is run standalone or imported from the backend.
_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=_ENV_PATH)


def load_llm():

    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        raise RuntimeError(
            f"GROQ_API_KEY not found. Looked for .env at: {_ENV_PATH}"
        )

    llm = ChatGroq(
        model=LLM_MODEL,
        api_key=api_key,
        temperature=0
    )

    return llm