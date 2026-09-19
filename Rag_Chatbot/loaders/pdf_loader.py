from pathlib import Path
from langchain_community.document_loaders import PyPDFLoader

def load_pdfs(data_folder):

    documents = []


    for pdf_file in Path(data_folder).glob("*.pdf"):
        loader = PyPDFLoader(str(pdf_file)) 
        pdf_documents = loader.load()

        documents.extend(pdf_documents)
    return documents