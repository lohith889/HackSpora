from sentence_transformers import CrossEncoder


class CrossEncoderReranker:

    def __init__(
        self,
        model_name="cross-encoder/ms-marco-MiniLM-L-6-v2"
    ):
        self.model = CrossEncoder(model_name)

    def rerank(
        self,
        query,
        documents,
        top_k=8,
        score_threshold=-1.0
    ):

        if not documents:
            return []

        pairs = [
            (query, doc.page_content)
            for doc in documents
        ]

        scores = self.model.predict(pairs)

        ranked = sorted(
            zip(documents, scores),
            key=lambda x: float(x[1]),
            reverse=True
        )

        # ---------------------------------------------
        # Remove low-scoring documents
        # ---------------------------------------------

        ranked = [
            (doc, float(score))
            for doc, score in ranked
            if float(score) >= score_threshold
        ]

        # ---------------------------------------------
        # Preserve page diversity
        # ---------------------------------------------

        selected = []
        seen_pages = set()

        # First pass: one chunk per page
        for doc, score in ranked:

            page = doc.metadata.get("page", -1)

            if page not in seen_pages:

                selected.append(
                    (doc, score)
                )

                seen_pages.add(page)

            if len(selected) >= top_k:
                break

        # ---------------------------------------------
        # Second pass: fill remaining slots
        # ---------------------------------------------

        if len(selected) < top_k:

            selected_ids = {
                id(doc)
                for doc, _ in selected
            }

            for doc, score in ranked:

                if id(doc) in selected_ids:
                    continue

                selected.append(
                    (doc, score)
                )

                if len(selected) >= top_k:
                    break

        return selected


def remove_duplicate_documents(ranked_results):

    seen = set()
    filtered = []

    for doc, score in ranked_results:

        content = doc.page_content.strip()

        if content in seen:
            continue

        seen.add(content)

        filtered.append(
            (doc, score)
        )

    return filtered