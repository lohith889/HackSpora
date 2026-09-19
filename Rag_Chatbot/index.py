import os

from loaders.pdf_loader import load_pdfs
from preprocess.splitter import split_documents
from embeddings.embedding_model import load_embedding_model
from vectordb.chroma_db import (
    create_vector_store,
    add_documents
)
from langchain_chroma import Chroma
from config import CHROMA_DB_DIR, COLLECTION_NAME, RAW_PDF_DIR


# ---------------------------------------------------
# Build / Rebuild the entire vector database
# ---------------------------------------------------
# Points at `raw_pdf/` by default. Pass a different
# folder to override (e.g. during testing).
# ---------------------------------------------------
def build_vector_database(pdf_folder=None):

    if pdf_folder is None:
        pdf_folder = RAW_PDF_DIR

    print("=" * 50)
    print(f"Building vector database from: {pdf_folder}")
    print("=" * 50)

    documents = load_pdfs(pdf_folder)

    print(f"Total pages loaded: {len(documents)}")

    chunks = split_documents(documents)

    print(f"Chunks created: {len(chunks)}")

    # Debug: show first chunk metadata
    if chunks:
        print(chunks[0].metadata)

    embedding_model = load_embedding_model()

    # -------------------------------------------------
    # Delete existing Chroma collection before rebuild
    # -------------------------------------------------

    if os.path.exists(CHROMA_DB_DIR):

        try:

            old_vector_store = Chroma(
                persist_directory=CHROMA_DB_DIR,
                embedding_function=embedding_model,
                collection_name=COLLECTION_NAME
            )

            old_vector_store.delete_collection()

            print("Old Chroma collection deleted.")

        except Exception as e:

            print(
                "Could not delete old collection:",
                e
            )

    # -------------------------------------------------
    # Create new vector store
    # -------------------------------------------------

    create_vector_store(
        chunks,
        embedding_model
    )

    print(
        "✅ Vector database rebuilt successfully."
    )


# ---------------------------------------------------
# Smart startup initialiser
# ---------------------------------------------------
# Call this once at application startup.
# - If ChromaDB already contains documents, indexing
#   is skipped for a fast startup.
# - If ChromaDB is empty (first run or after a clear),
#   all PDFs in `raw_pdf/` are loaded, chunked,
#   embedded and persisted automatically.
# ---------------------------------------------------
def initialize_knowledge_base():

    print("=" * 50)
    print("Initialising knowledge base...")
    print(f"Raw PDF folder: {RAW_PDF_DIR}")
    print("=" * 50)

    embedding_model = load_embedding_model()

    # Check if ChromaDB already has documents
    if os.path.exists(CHROMA_DB_DIR):

        try:

            existing_store = Chroma(
                persist_directory=CHROMA_DB_DIR,
                embedding_function=embedding_model,
                collection_name=COLLECTION_NAME
            )

            count = existing_store._collection.count()

            if count > 0:
                print(
                    f"✅ Knowledge base already indexed "
                    f"({count} chunks). Skipping re-indexing."
                )
                return

        except Exception as e:

            print(
                f"⚠️  Could not read existing ChromaDB: {e}. "
                "Will re-index from scratch."
            )

    # ChromaDB is empty or missing — index raw PDFs now
    print(
        f"📂 No existing index found. "
        f"Indexing PDFs from '{RAW_PDF_DIR}'..."
    )

    documents = load_pdfs(RAW_PDF_DIR)

    if not documents:
        print(
            f"❌ No PDF files found in '{RAW_PDF_DIR}'. "
            "Please add PDFs and restart."
        )
        return

    print(f"Total pages loaded: {len(documents)}")

    chunks = split_documents(documents)

    print(f"Chunks created: {len(chunks)}")

    if not chunks:
        print("❌ No chunks created from PDFs!")
        return

    try:

        add_documents(chunks, embedding_model)
        print("✅ Documents added to existing ChromaDB.")

    except Exception:

        create_vector_store(chunks, embedding_model)
        print("✅ New ChromaDB created and populated successfully.")

    print(
        f"🎉 Knowledge base ready — "
        f"{len(chunks)} chunks from {RAW_PDF_DIR}."
    )


# ---------------------------------------------------
# Run directly to index / re-index the knowledge base
# ---------------------------------------------------
if __name__ == "__main__":

    import argparse

    parser = argparse.ArgumentParser(
        description="Manage the RAG knowledge base."
    )

    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="Force a full rebuild of the vector database."
    )

    args = parser.parse_args()

    if args.rebuild:
        print("🔄 Forcing full rebuild...")
        build_vector_database()
    else:
        initialize_knowledge_base()