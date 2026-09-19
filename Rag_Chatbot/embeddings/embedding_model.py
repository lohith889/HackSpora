from langchain_huggingface import HuggingFaceEmbeddings
from config import EMBEDDING_MODEL

def load_embedding_model():

    embedding_model = HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL,
    )
    return embedding_model