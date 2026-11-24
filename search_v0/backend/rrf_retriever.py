
from langchain_classic.retrievers import EnsembleRetriever
from bm25_retriever import get_bm25_retriever
from dense_retriever import get_dense_retriever

async def run_rrf_hybrid_search(
    texts: list[str],
    query: str,
    weights: list[float] = [0.5, 0.5],
    c: int = 60,
    k: int = 4
) -> list[dict]:
    """
    Fusionne BM25 et Google Embeddings via EnsembleRetriever (algorithme RRF natif).
    'c' est la constante de lissage RRF (60 par défaut).
    """
    bm25_retriever = get_bm25_retriever(texts, k=k)
    dense_retriever, _ = get_dense_retriever(texts, k=k)

    ensemble_retriever = EnsembleRetriever(
        retrievers=[bm25_retriever, dense_retriever],
        weights=weights,
        c=c
    )

    fused_docs = await ensemble_retriever.ainvoke(query)

    return [
        {
            "final_rank": rank + 1,
            "doc_id": doc.metadata["doc_id"],
            "content": doc.page_content
        }
        for rank, doc in enumerate(fused_docs[:k])
    ]