from langchain_chroma import Chroma

from config import CHROMA_DB_DIR


def delete_document(pdf_name, embedding_model):
    """
    Delete all chunks belonging to a PDF from ChromaDB.
    """

    vector_store = Chroma(
        persist_directory=CHROMA_DB_DIR,
        embedding_function=embedding_model
    )

    # Get all documents and metadata
    data = vector_store.get(
        include=["metadatas"]
    )

    ids_to_delete = []

    for doc_id, metadata in zip(
        data["ids"],
        data["metadatas"]
    ):

        source = metadata.get("source", "")

        if source.endswith(pdf_name):
            ids_to_delete.append(doc_id)

    if ids_to_delete:

        vector_store.delete(
            ids=ids_to_delete
        )

        return len(ids_to_delete)

    return 0