# backend/main.py
import re
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer #type: ignore

app = FastAPI(title="Semantic Chunking API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Chargement unique du modèle au démarrage du serveur (évite de le recharger à chaque requête)
model = SentenceTransformer("all-MiniLM-L6-v2")

class ChunkRequest(BaseModel):
    text: str = Field(..., min_length=10)
    percentile_threshold: int = Field(default=85, ge=50, le=99)
    buffer_size: int = Field(default=1, ge=0, le=3)

@app.post("/api/chunk")
def compute_semantic_chunks(req: ChunkRequest):
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', req.text) if s.strip()]
    
    if len(sentences) <= 2:
        return {
            "chunks": [{"id": 1, "text": req.text, "sentence_count": len(sentences)}],
            "distances": [],
            "threshold_value": 0.0,
            "sentences": sentences
        }

    # Fenêtres locales paramétrables
    buffered_sentences = [
        " ".join(sentences[max(0, i - req.buffer_size) : min(len(sentences), i + req.buffer_size + 1)])
        for i in range(len(sentences))
    ]

    embeddings = model.encode(buffered_sentences, normalize_embeddings=True)

    distances = [
        round(1.0 - float(np.dot(embeddings[i], embeddings[i + 1])), 4)
        for i in range(len(embeddings) - 1)
    ]

    breakpoint_threshold = round(float(np.percentile(distances, req.percentile_threshold)), 4)

    chunks = []
    current_chunk = [sentences[0]]

    for i, dist in enumerate(distances):
        if dist > breakpoint_threshold:
            chunks.append({
                "id": len(chunks) + 1,
                "text": " ".join(current_chunk),
                "sentence_count": len(current_chunk)
            })
            current_chunk = [sentences[i + 1]]
        else:
            current_chunk.append(sentences[i + 1])

    if current_chunk:
        chunks.append({
            "id": len(chunks) + 1,
            "text": " ".join(current_chunk),
            "sentence_count": len(current_chunk)
        })

    return {
        "chunks": chunks,
        "distances": distances,
        "threshold_value": breakpoint_threshold,
        "sentences": sentences
    }