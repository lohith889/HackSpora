from langchain_chroma import Chroma
from config import CHROMA_DB_DIR,COLLECTION_NAME


def load_vector_store(embedding_model):

    return Chroma(
        persist_directory=CHROMA_DB_DIR,
        embedding_function=embedding_model,
        collection_name=COLLECTION_NAME
    )


def create_vector_store(chunks, embedding_model):

    ids = [
        chunk.metadata["chunk_id"]
        for chunk in chunks
    ]

    vector_store = Chroma.from_documents(
        documents=chunks,
        embedding=embedding_model,
        ids=ids,
        persist_directory=CHROMA_DB_DIR,
        collection_name=COLLECTION_NAME
    )

    return vector_store

def add_documents(chunks, embedding_model):

    vector_store = load_vector_store(embedding_model)

    ids = [
        chunk.metadata["chunk_id"]
        for chunk in chunks
    ]

    vector_store.add_documents(
        documents=chunks,
        ids=ids
    )

    return vector_store