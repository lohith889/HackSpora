import os

# Absolute path to the Rag_Chatbot directory — works regardless of
# which directory the server is launched from.
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

# Use absolute paths so relative-path issues don't occur when imported
# from the FastAPI backend (which runs from HackSpora/backend/).
CHROMA_DB_DIR = os.path.join(_BASE_DIR, "chroma_db")

COLLECTION_NAME = "rag_documents"

LLM_MODEL = "openai/gpt-oss-20b"  # verified model for this Groq key

# Folder containing the pre-loaded, read-only knowledge base PDFs.
# Users do NOT upload PDFs at runtime; all source documents live here.
RAW_PDF_DIR = os.path.join(_BASE_DIR, "raw_pdf")
