"use client";

import React, { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, Sparkles, Radio } from "lucide-react";
import { SearchEngineType, SearchResultItem } from "@/types/search";
import { streamSearchEngine } from "@/lib/sse-client";
import { CorpusManager } from "@/components/CorpusManager";
import { SearchStreamCard } from "@/components/SearchStreamCard";

const INITIAL_CORPUS = [
  "Le protocole TLS 1.3 réduit la latence de connexion et renforce le chiffrement.",
  "L'erreur ERR_CERT_REVOKED indique que le certificat SSL a été révoqué par l'autorité.",
  "En cas de révocation d'une autorisation d'accès, contactez l'administrateur sécurité.",
  "Pour configurer le pare-feu, ouvrez le port 443 en TCP entrant.",
];

const INITIAL_QUERY = "Problème de certificat SSL ERR_CERT_REVOKED";

interface EngineState {
  results: SearchResultItem[];
  status: string;
  isStreaming: boolean;
  error: string | null;
}

const emptyEngineState = (): EngineState => ({
  results: [],
  status: "",
  isStreaming: false,
  error: null,
});

export default function HybridSearchPage() {
  const [corpus, setCorpus] = useState<string[]>(INITIAL_CORPUS);
  const [query, setQuery] = useState<string>(INITIAL_QUERY);

  const [engines, setEngines] = useState<Record<SearchEngineType, EngineState>>(
    {
      bm25: emptyEngineState(),
      dense: emptyEngineState(),
      rrf: emptyEngineState(),
    },
  );

  const abortControllersRef = useRef<
    Partial<Record<SearchEngineType, AbortController>>
  >({});

  const runSingleEngine = (engine: SearchEngineType) => {
    if (!query.trim()) return;

    // Annule un éventuel flux précédent sur ce même moteur
    abortControllersRef.current[engine]?.abort();
    const controller = new AbortController();
    abortControllersRef.current[engine] = controller;

    setEngines((prev) => ({
      ...prev,
      [engine]: {
        results: [],
        status: "Initialisation...",
        isStreaming: true,
        error: null,
      },
    }));

    streamSearchEngine({
      engine,
      query,
      corpus,
      topK: corpus.length,
      signal: controller.signal,
      onStatus: (msg) => {
        setEngines((prev) => ({
          ...prev,
          [engine]: { ...prev[engine], status: msg },
        }));
      },
      onResult: (item) => {
        setEngines((prev) => ({
          ...prev,
          [engine]: {
            ...prev[engine],
            results: [...prev[engine].results, item],
          },
        }));
      },
      onDone: () => {
        setEngines((prev) => ({
          ...prev,
          [engine]: { ...prev[engine], isStreaming: false, status: "Terminé" },
        }));
      },
      onError: (errMsg) => {
        setEngines((prev) => ({
          ...prev,
          [engine]: { ...prev[engine], isStreaming: false, error: errMsg },
        }));
      },
    });
  };

  const handleRunAll = (e: React.FormEvent) => {
    e.preventDefault();
    runSingleEngine("bm25");
    runSingleEngine("dense");
    runSingleEngine("rrf");
  };

  const isAnyStreaming =
    engines.bm25.isStreaming ||
    engines.dense.isStreaming ||
    engines.rrf.isStreaming;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* En-tête */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Radio className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight">
                LangChain Hybrid Search & RRF Studio
              </h1>
            </div>
            <p className="text-muted-foreground mt-1">
              Comparaison en temps réel via Server-Sent Events (SSE) : BM25
              Lexical, Google Embeddings et Reciprocal Rank Fusion.
            </p>
          </div>
          <Badge variant="outline" className="w-fit px-3 py-1 text-sm">
            Module 2.3 • LangChain + Gemini Embeddings
          </Badge>
        </div>

        <Separator />

        {/* Barre de Requête */}
        <form
          onSubmit={handleRunAll}
          className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Entrez votre requête (ex: Problème de certificat SSL ERR_CERT_REVOKED)..."
              className="pl-9 h-10"
            />
          </div>
          <Button
            type="submit"
            disabled={!query.trim() || isAnyStreaming}
            className="h-10 px-6">
            <Sparkles className="h-4 w-4 mr-2" />
            Comparer les 3 moteurs (SSE)
          </Button>
        </form>

        {/* Gestionnaire de Corpus */}
        <CorpusManager corpus={corpus} onChangeCorpus={setCorpus} />

        {/* Grille des 3 moteurs SSE séparés */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          <SearchStreamCard
            title="1. Recherche Lexicale (BM25)"
            subtitle="LangChain BM25Retriever • Correspondance exacte des termes et codes techniques."
            engine="bm25"
            badgeLabel="Sparse • /stream/bm25"
            results={engines.bm25.results}
            statusMessage={engines.bm25.status}
            isStreaming={engines.bm25.isStreaming}
            error={engines.bm25.error}
            onTriggerSingle={runSingleEngine}
            disabled={!query.trim()}
          />

          <SearchStreamCard
            title="2. Recherche Vectorielle Dense"
            subtitle="GoogleGenerativeAIEmbeddings • Proximité sémantique et synonymes (Cosinus)."
            engine="dense"
            badgeLabel="Dense • /stream/dense"
            results={engines.dense.results}
            statusMessage={engines.dense.status}
            isStreaming={engines.dense.isStreaming}
            error={engines.dense.error}
            onTriggerSingle={runSingleEngine}
            disabled={!query.trim()}
          />

          <SearchStreamCard
            title="3. Fusion Hybride (RRF)"
            subtitle="LangChain EnsembleRetriever (k=60) • Consensus ordinal BM25 + Google Embeddings."
            engine="rrf"
            badgeLabel="Hybrid RRF • /stream/rrf"
            results={engines.rrf.results}
            statusMessage={engines.rrf.status}
            isStreaming={engines.rrf.isStreaming}
            error={engines.rrf.error}
            onTriggerSingle={runSingleEngine}
            disabled={!query.trim()}
          />
        </div>
      </div>
    </div>
  );
}
