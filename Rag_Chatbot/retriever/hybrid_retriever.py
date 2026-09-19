from vectordb.chroma_db import load_vector_store


def load_hybrid_retriever(embedding_model):
    """
    Load the semantic retriever backed by ChromaDB.

    ChromaDB is indexed ONCE at startup (via initialize_knowledge_base).
    Every query fetches results directly from the persisted vector store
    with no re-loading, re-chunking, or re-embedding of PDFs.

    BM25 has been removed: it is an in-memory retriever that requires
    re-chunking all PDFs on every server start, which is the opposite of
    the desired "index once, query many" behaviour.
    """

    # Load the already-indexed ChromaDB vector store
    vector_store = load_vector_store(embedding_model)

    # MMR (Maximal Marginal Relevance) gives diverse, high-quality results
    retriever = vector_store.as_retriever(
        search_type="mmr",
        search_kwargs={
            "k": 10,
            "fetch_k": 40,
            "lambda_mult": 0.75
        }
    )

    return retriever