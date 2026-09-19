import os
import shutil
import streamlit as st

from embeddings.embedding_model import load_embedding_model
from retriever.hybrid_retriever import load_hybrid_retriever
from llm.llm import load_llm
from rag.rag_chain import ask_question

from index import index_pdf, build_vector_database

from utils.file_manager import (
    get_uploaded_pdfs,
    delete_pdf
)

from utils.greetings import (
    is_greeting,
    greeting_response
)

from utils.source_utils import group_sources

from retriever.reranker import CrossEncoderReranker


# -------------------------------------------------------
# Page Configuration
# -------------------------------------------------------

st.set_page_config(
    page_title="RAG Chatbot",
    page_icon="📚",
    layout="wide"
)


# -------------------------------------------------------
# Session State
# -------------------------------------------------------

if "last_uploaded" not in st.session_state:
    st.session_state.last_uploaded = None

if "processed_upload" not in st.session_state:
    st.session_state.processed_upload = None

if "messages" not in st.session_state:
    st.session_state.messages = []


# -------------------------------------------------------
# Page Title
# -------------------------------------------------------

st.title("📚 RAG Chatbot")

st.write(
    "Ask questions from your PDF documents."
)


# -------------------------------------------------------
# Load Models
# -------------------------------------------------------

@st.cache_resource
def load_models():

    embedding_model = load_embedding_model()

    retriever = load_hybrid_retriever(
        embedding_model
    )

    llm = load_llm()

    reranker = CrossEncoderReranker()

    return (
        embedding_model,
        retriever,
        llm,
        reranker
    )


(
    embedding_model,
    retriever,
    llm,
    reranker
) = load_models()


# -------------------------------------------------------
# Sidebar
# -------------------------------------------------------

st.sidebar.title("📂 PDF Management")


uploaded_file = st.sidebar.file_uploader(
    "Upload a PDF",
    type=["pdf"]
)


# -------------------------------------------------------
# Reset Upload State
# -------------------------------------------------------

if uploaded_file is None:

    st.session_state.processed_upload = None


# -------------------------------------------------------
# Upload PDF
# -------------------------------------------------------

if uploaded_file is not None:

    if (
        uploaded_file.name
        != st.session_state.processed_upload
    ):

        save_path = os.path.join(
            "uploads",
            uploaded_file.name
        )

        # ---------------------------------------------
        # Duplicate check
        # ---------------------------------------------

        if os.path.exists(save_path):

            st.sidebar.warning(
                "⚠️ This PDF already exists."
            )

        else:

            # -----------------------------------------
            # Save PDF
            # -----------------------------------------

            with open(
                save_path,
                "wb"
            ) as f:

                f.write(
                    uploaded_file.getbuffer()
                )


            st.sidebar.success(
                f"{uploaded_file.name} "
                "uploaded successfully!"
            )


            # -----------------------------------------
            # Index PDF
            # -----------------------------------------

            with st.spinner(
                "Indexing PDF..."
            ):

                index_pdf(
                    save_path
                )


            # -----------------------------------------
            # Reload models
            # -----------------------------------------

            st.cache_resource.clear()

            (
                embedding_model,
                retriever,
                llm,
                reranker
            ) = load_models()


            st.sidebar.success(
                "✅ Vector Database Updated!"
            )


        st.session_state.processed_upload = (
            uploaded_file.name
        )


# -------------------------------------------------------
# Uploaded Documents
# -------------------------------------------------------

st.sidebar.divider()

st.sidebar.subheader(
    "📄 Uploaded Documents"
)


pdfs = get_uploaded_pdfs()


if len(pdfs) == 0:

    st.sidebar.info(
        "No PDFs uploaded."
    )

else:

    for pdf in pdfs:

        col1, col2 = st.sidebar.columns(
            [4, 1]
        )


        with col1:

            st.write(
                f"📄 {pdf}"
            )


        with col2:

            if st.button(
                "❌",
                key=f"delete_{pdf}"
            ):

                deleted_chunks = delete_pdf(
                    pdf,
                    embedding_model
                )


                # -------------------------------------
                # Reload retriever
                # -------------------------------------

                st.cache_resource.clear()

                (
                    embedding_model,
                    retriever,
                    llm,
                    reranker
                ) = load_models()


                st.success(
                    f"✅ {pdf} deleted "
                    f"({deleted_chunks} chunks removed)"
                )


                st.rerun()


# -------------------------------------------------------
# Database Status
# -------------------------------------------------------

st.sidebar.divider()

st.sidebar.subheader(
    "📊 Database Status"
)


st.sidebar.write(
    f"Documents : {len(pdfs)}"
)


# -------------------------------------------------------
# Rebuild Database
# -------------------------------------------------------

if st.sidebar.button(
    "🔄 Rebuild Database"
):

    with st.spinner(
        "Rebuilding database..."
    ):

        st.cache_resource.clear()

        build_vector_database(
            "uploads"
        )


        (
            embedding_model,
            retriever,
            llm,
            reranker
        ) = load_models()


    st.sidebar.success(
        "✅ Database rebuilt successfully!"
    )


# -------------------------------------------------------
# Clear Database
# -------------------------------------------------------

if st.sidebar.button(
    "🗑 Clear Database"
):

    if os.path.exists(
        "chroma_db"
    ):

        shutil.rmtree(
            "chroma_db"
        )


    st.cache_resource.clear()


    st.sidebar.success(
        "✅ Database cleared!"
    )


# =======================================================
# Display Previous Chat Messages
# =======================================================

for message in st.session_state.messages:

    with st.chat_message(
        message["role"]
    ):

        st.markdown(
            message["content"]
        )


        # ---------------------------------------------
        # Display sources
        # ---------------------------------------------

        if (
            message["role"] == "assistant"
            and message.get("sources")
        ):

            grouped_sources = group_sources(
                message["sources"]
            )


            if grouped_sources:

                st.markdown(
                    "### 📚 Sources"
                )


                for file, pages in (
                    grouped_sources.items()
                ):

                    st.markdown(
                        f"📄 **{file}**"
                    )


                    for page in sorted(
                        pages
                    ):

                        st.markdown(
                            f"&nbsp;&nbsp;&nbsp;• "
                            f"Page {page}"
                        )


# =======================================================
# Chat Input
# =======================================================

question = st.chat_input(
    "Ask a question..."
)


# =======================================================
# Ask Question
# =======================================================

if question:

    # ---------------------------------------------------
    # Save user message
    # ---------------------------------------------------

    st.session_state.messages.append(
        {
            "role": "user",
            "content": question
        }
    )


    # ---------------------------------------------------
    # Display user message
    # ---------------------------------------------------

    with st.chat_message(
        "user"
    ):

        st.markdown(
            question
        )


    # ---------------------------------------------------
    # Greeting
    # ---------------------------------------------------

    if is_greeting(
        question
    ):

        answer = greeting_response(
            question
        )

        sources = []


        with st.chat_message(
            "assistant"
        ):

            st.markdown(
                answer
            )


    # ---------------------------------------------------
    # RAG Question
    # ---------------------------------------------------

    else:

        answer = ""

        sources = []


        # ---------------------------------------------
        # Run RAG ONLY ONCE
        # ---------------------------------------------

        with st.spinner(
            "Thinking..."
        ):

            for result in ask_question(
                question,
                st.session_state.messages,
                retriever,
                llm,
                reranker
            ):

                if result["type"] == "text":

                    answer += result["content"]


                elif result["type"] == "sources":

                    sources = result["content"]


        # ---------------------------------------------
        # Display complete assistant response ONCE
        # ---------------------------------------------

        with st.chat_message(
            "assistant"
        ):

            st.markdown(
                answer
            )


            # -----------------------------------------
            # Display sources ONCE
            # -----------------------------------------

            if sources:

                grouped_sources = group_sources(
                    sources
                )


                if grouped_sources:

                    st.markdown(
                        "### 📚 Sources"
                    )


                    for file, pages in (
                        grouped_sources.items()
                    ):

                        st.markdown(
                            f"📄 **{file}**"
                        )


                        for page in sorted(
                            pages
                        ):

                            st.markdown(
                                f"&nbsp;&nbsp;&nbsp;• "
                                f"Page {page}"
                            )


    # ---------------------------------------------------
    # Save assistant message
    # ---------------------------------------------------

    st.session_state.messages.append(
        {
            "role": "assistant",
            "content": answer,
            "sources": sources
        }
    )