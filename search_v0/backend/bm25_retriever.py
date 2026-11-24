
import re
from langchain_core.documents import Document
from langchain_community.retrievers import BM25Retriever

def custom_tokenizer(text: str) -> list[str]:
    """Préserve les identifiants exacts avec underscores (ex: ERR_CERT_REVOKED)."""
    return re.findall(r"\w+", text.lower())

def get_bm25_retriever(texts: list[str], k: int = 4) -> BM25Retriever:
    """Construit un retriever BM25 LangChain indépendant."""
    docs = [
        Document(page_content=text, metadata={"doc_id": idx})
        for idx, text in enumerate(texts)
    ]
    retriever = BM25Retriever.from_documents(
        documents=docs,
        preprocess_func=custom_tokenizer,
        k=k
    )
    return retriever

async def run_bm25_search(texts: list[str], query: str, k: int = 4) -> list[dict]:
    """Exécute la recherche BM25 et retourne les résultats formatés."""
    retriever = get_bm25_retriever(texts, k=k)
    results = await retriever.ainvoke(query)
    return [
        {
            "rank": rank + 1,
            "doc_id": doc.metadata["doc_id"],
            "content": doc.page_content
        }
        for rank, doc in enumerate(results)
    ]