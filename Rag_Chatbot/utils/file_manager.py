import os

from vectordb.delete_documents import delete_document

UPLOAD_FOLDER = "uploads"


def get_uploaded_pdfs():

    if not os.path.exists(UPLOAD_FOLDER):
        return []

    pdfs = [
        file
        for file in os.listdir(UPLOAD_FOLDER)
        if file.endswith(".pdf")
    ]

    return sorted(pdfs)


def delete_pdf(filename, embedding_model):

    # Delete vectors from ChromaDB
    deleted_chunks = delete_document(
        filename,
        embedding_model
    )

    # Delete PDF file
    path = os.path.join(
        UPLOAD_FOLDER,
        filename
    )

    if os.path.exists(path):
        os.remove(path)

    return deleted_chunks