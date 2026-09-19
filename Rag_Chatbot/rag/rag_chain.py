import os
import re

from langchain_core.prompts import ChatPromptTemplate
from retriever.reranker import remove_duplicate_documents
from utils.source_utils import extract_sources



def clean_model_output(text):

    if not text:
        return ""

    # Remove reasoning / thought blocks
    text = re.sub(
        r"<think>.*?</think>",
        "",
        text,
        flags=re.DOTALL
    )

    # Convert HTML line breaks to real newlines
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)

    # Remove any stray HTML tags
    text = re.sub(r"(?i)</?(?:p|div|span|strong|b|em|i)[^>]*>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)

    # Collapse excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


# -------------------------------------------------
# RAG prompt
# -------------------------------------------------
def build_rag_prompt():

    return ChatPromptTemplate.from_template(
        """
You are KisanGuard AI — the specialized Agricultural Scheme Advisory Assistant for Indian farmers and field officers.

Your sole purpose is to provide authoritative, highly accurate information strictly derived from the official government operational guidelines and scheme documents indexed in this system:
1. PM-KISAN (Pradhan Mantri Kisan Samman Nidhi) — Operational Guidelines, eligibility criteria, exclusion rules (taxpayers, institutional landholders, constitutional posts, pension > ₹10,000), installment disbursal, Aadhaar/DBT mandates, and eKYC.
2. PMFBY (Pradhan Mantri Fasal Bima Yojana) — Crop insurance coverage (yield loss, localized calamities, post-harvest losses), farmer premium rates (2% Kharif food/oilseeds, 1.5% Rabi food/oilseeds, 5% commercial/horticultural crops), claim calculation, and dispute timelines.
3. PM-KISAN Physical Verification Protocols — 5% mandatory field audits, verification checklists, ineligibility recovery, and district committee responsibilities.
4. Agricultural Procurement & MSP Operations — Minimum Support Price procurement, Fair Average Quality (FAQ) norms, and direct farmer payment rules.
5. Digital Declarations & Land Records — Farmer self-declarations, land record validation, and authentication standards.

STRICT OPERATIONAL RULES:
- Ground all facts ONLY in the provided Context below. Never assume, fabricate, or extrapolate beyond these documents.
- Clearly identify the applicable scheme (e.g., "Under PM-KISAN Guidelines:" or "Under PMFBY Provisions:").
- If the question cannot be answered using the provided context or asks about unrelated topics, reply strictly:
  "This information is not covered in the official PM-KISAN, PMFBY, or Procurement scheme guidelines available in the KisanGuard knowledge base. Please consult your local Agricultural Department (Krishi Bhavan) or the official scheme portal."

FORMATTING & PRESENTATION STANDARDS:
- Structure answers into clean, logical sections using bold headers (e.g., **Eligibility Criteria:**, **Financial Benefit:**, **Required Documents / Action:**).
- Use clear bullet points for conditions, steps, or exclusions.
- Write in clear, professional, yet farmer-accessible language.
- Never output raw HTML tags (such as <br>, <p>, <div>). Use standard clean line breaks and bullet points.

Conversation History:
{history}

Context:
{context}

Question:
{question}

Structured Advisory:
"""
    )


# -------------------------------------------------
# Format retrieved documents
# -------------------------------------------------
def format_context(documents):

    return "\n\n".join(
        doc.page_content
        for doc in documents
    )


# -------------------------------------------------
# Query rewrite prompt
# -------------------------------------------------
def build_query_rewrite_prompt():

    return ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """
You rewrite user questions for document retrieval.

Your goal is to create a standalone retrieval query.

Rules:

1. If the user's question is already standalone and clear,
   return it unchanged.

2. Only rewrite the question when it contains a reference that
   requires conversation history, such as:
   "it", "this", "that", "they", "the previous model",
   "how does it work", or similar references.

3. Preserve the original meaning of the question.

4. Do not expand abbreviations unnecessarily.

5. Do not replace terms with their full names unless necessary
   to resolve ambiguity.

6. Do not add information that is not present in the question
   or conversation history.

7. Do not answer the question.

8. Return ONLY the standalone question.

Conversation History:
{history}
"""
            ),
            (
                "human",
                "Question:\n{question}"
            )
        ]
    )
# -------------------------------------------------
# Rewrite follow-up question
# -------------------------------------------------
def rewrite_query(question, chat_history, llm):
    
    if not chat_history:
        return question.strip()

    history = ""

    for message in chat_history:

        history += (
            f"{message['role'].capitalize()}: "
            f"{message['content']}\n"
        )

    prompt = build_query_rewrite_prompt()

    messages = prompt.format_messages(
        history=history,
        question=question
    )

    response = llm.invoke(messages)

    if isinstance(response.content, list):

        rewritten = ""

        for item in response.content:

            if (
                isinstance(item, dict)
                and item.get("type") == "text"
            ):
                rewritten += item.get("text", "")

            return clean_model_output(rewritten)

    return clean_model_output(response.content)


# -------------------------------------------------
# Main RAG pipeline
# -------------------------------------------------
def ask_question(question, chat_history, retriever, llm,reranker):

    # -------------------------------------------------
    # Rewrite follow-up question
    # -------------------------------------------------

    standalone_question = rewrite_query(
        question,
        chat_history,
        llm
    )

    print(f"Original: {question}")
    print(f"Standalone: {standalone_question}")

    # -------------------------------------------------
    # Retrieve documents
    # -------------------------------------------------

    # -------------------------------------------------
    # Retrieve candidate documents
    # -------------------------------------------------

    docs = retriever.invoke(
        standalone_question
    )

    print(
        f"Retrieved chunks: {len(docs)}"
    )

    # -------------------------------------------------
    # Cross-encoder reranking
    # -------------------------------------------------

    reranked_results = reranker.rerank(
        standalone_question,
        docs,
        top_k=4
    )

    # -------------------------------------------------
    # Preserve top MMR candidates
    # -------------------------------------------------

    mmr_results = [
        (doc, 0.0)
        for doc in docs[:4]
    ]

    # -------------------------------------------------
    # Combine both
    # -------------------------------------------------

    combined_results = (
        reranked_results +
        mmr_results
    )

    # -------------------------------------------------
    # Remove duplicate chunks
    # -------------------------------------------------

    combined_results = remove_duplicate_documents(
        combined_results
    )

    # -------------------------------------------------
    # Final top K
    # -------------------------------------------------

    combined_results = combined_results[:8]

    
    reranked_docs = [
        doc
        for doc, score in combined_results
    ]


    print("\n" + "=" * 60)
    print("HYBRID RETRIEVAL RESULTS")
    print("=" * 60)

    for i, (doc, score) in enumerate(
        reranked_results,
        start=1
    ):

        print(
            i,
            os.path.basename(
                doc.metadata.get("source", "")
            ),
            "Page:",
            doc.metadata.get("page", 0) + 1,
            "Score:",
            float(score)
        )
    print(
        f"Reranked chunks: {len(reranked_docs)}"
    )


    # -------------------------------------------------
    # Build context
    # -------------------------------------------------

    context = format_context(reranked_docs)


    print("\n" + "=" * 60)
    print("FINAL CONTEXT SENT TO LLM")
    print("=" * 60)

    print(context)
    # -------------------------------------------------
    # Build prompt
    # -------------------------------------------------

    prompt = build_rag_prompt()

    history = ""

    for message in chat_history:

        history += (
            f"{message['role'].capitalize()}: "
            f"{message['content']}\n"
        )

    messages = prompt.format_messages(
        context=context,
        question=standalone_question,
        history=history
    )

    # -------------------------------------------------
    # Stream response
    # -------------------------------------------------

    for chunk in llm.stream(messages):

        if isinstance(chunk.content, str):

            yield {
                "type": "text",
                "content": chunk.content
            }

        elif isinstance(chunk.content, list):

            for item in chunk.content:

                if (
                    isinstance(item, dict)
                    and item.get("type") == "text"
                ):

                    yield {
                        "type": "text",
                        "content": item.get("text", "")
                    }

    # -------------------------------------------------
    # Sources
    # -------------------------------------------------

    sources = extract_sources(reranked_docs)

    yield {
        "type": "sources",
        "content": sources
    }