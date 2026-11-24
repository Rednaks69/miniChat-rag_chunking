
from langchain_core.documents import Document
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_google_genai import GoogleGenerativeAIEmbeddings

def get_dense_retriever(texts: list[str], k: int = 4):
    """Construit un VectorStore LangChain propulsé par Google Embeddings."""
    embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
    
    docs = [
        Document(page_content=text, metadata={"doc_id": idx})
        for idx, text in enumerate(texts)
    ]
    
    vector_store = InMemoryVectorStore.from_documents(
        documents=docs,
        embedding=embeddings
    )
    return vector_store.as_retriever(search_kwargs={"k": k}), vector_store

async def run_dense_search(texts: list[str], query: str, k: int = 4) -> list[dict]:
    """Exécute la recherche vectorielle dense avec scores de similarité."""
    _, vector_store = get_dense_retriever(texts, k=k)
    
    # similarity_search_with_score renvoie (Document, score_cosinus)
    results_with_scores = await vector_store.asimilarity_search_with_score(query, k=k)
    
    return [
        {
            "rank": rank + 1,
            "doc_id": doc.metadata["doc_id"],
            "cosine_score": round(float(score), 4),
            "content": doc.page_content
        }
        for rank, (doc, score) in enumerate(results_with_scores)
    ]