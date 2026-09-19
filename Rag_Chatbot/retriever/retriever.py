from langchain_chroma import Chroma
from config import CHROMA_DB_DIR

def load_retriever(embedding_model):
    vector_store = Chroma(
        persist_directory=CHROMA_DB_DIR,
        embedding_function=embedding_model
    )

    retriever = vector_store.as_retriever(
    search_type="mmr",
    search_kwargs={
        "k": 5,
        "fetch_k": 25,
        "lambda_mult": 0.75
    }
)

    return retriever

