# main.py
import json
import asyncio
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import uvicorn

from bm25_retriever import run_bm25_search
from dense_retriever import run_dense_search
from rrf_retriever import run_rrf_hybrid_search

load_dotenv()

app = FastAPI(title="LangChain Hybrid Search SSE API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_CORPUS = [
    "Le protocole TLS 1.3 réduit la latence de connexion et renforce le chiffrement.",
    "L'erreur ERR_CERT_REVOKED indique que le certificat SSL a été révoqué par l'autorité.",
    "En cas de révocation d'une autorisation d'accès, contactez l'administrateur sécurité.",
    "Pour configurer le pare-feu, ouvrez le port 443 en TCP entrant."
]

class SearchRequest(BaseModel):
    query: str = Field(..., min_length=2)
    corpus: list[str] = Field(default=DEFAULT_CORPUS)
    top_k: int = Field(default=4, ge=1, le=20)

def format_sse(event_type: str, data: dict) -> str:
    """Formate un événement conforme au standard Server-Sent Events (SSE)."""
    payload = json.dumps({"type": event_type, **data}, ensure_ascii=False)
    return f"data: {payload}\n\n"

# 1. Endpoint SSE : BM25 uniquement
@app.post("/stream/bm25")
async def stream_bm25(req: SearchRequest):
    async def event_generator():
        yield format_sse("status", {"message": "Exécution de la recherche lexicale BM25..."})
        results = await run_bm25_search(req.corpus, req.query, k=req.top_k)
        
        for item in results:
            yield format_sse("result", {"engine": "bm25", "item": item})
            await asyncio.sleep(0.05)  # Permet un rendu progressif côté client
            
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

# 2. Endpoint SSE : Google Embeddings Dense Search uniquement
@app.post("/stream/dense")
async def stream_dense(req: SearchRequest):
    async def event_generator():
        yield format_sse("status", {"message": "Calcul des embeddings Google et recherche cosinus..."})
        results = await run_dense_search(req.corpus, req.query, k=req.top_k)
        
        for item in results:
            yield format_sse("result", {"engine": "dense", "item": item})
            await asyncio.sleep(0.05)
            
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

# 3. Endpoint SSE : Fusion Hybride RRF uniquement
@app.post("/stream/rrf")
async def stream_rrf(req: SearchRequest):
    async def event_generator():
        yield format_sse("status", {"message": "Fusion RRF (BM25 + Google Embeddings) en cours..."})
        results = await run_rrf_hybrid_search(req.corpus, req.query, weights=[0.5, 0.5], c=60, k=req.top_k)
        
        for item in results:
            yield format_sse("result", {"engine": "rrf", "item": item})
            await asyncio.sleep(0.05)
            
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)