"use client"

import React, { useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Scissors, Sparkles, Activity, Layers, Loader2 } from "lucide-react"

interface SemanticChunk {
  id: number
  text: string
  sentence_count: number
}

interface ChunkResponse {
  chunks: SemanticChunk[]
  distances: number[]
  threshold_value: number
  sentences: string[]
}

const DEFAULT_TEXT = `Les bases de données vectorielles utilisent des index HNSW pour accélérer la recherche. L'algorithme HNSW construit un graphe navigable à plusieurs niveaux. Cela permet d'atteindre une complexité logarithmique lors des requêtes. Par ailleurs, la cuisson du pain au levain nécessite une fermentation lente. La température idéale de pousse se situe autour de 24 degrés Celsius.`

export default function SemanticChunkerPage() {
  const [text, setText] = useState<string>(DEFAULT_TEXT)
  const [percentile, setPercentile] = useState<number>(80)
  const [bufferSize, setBufferSize] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(false)
  const [result, setResult] = useState<ChunkResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("http://localhost:8000/api/chunk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          percentile_threshold: percentile,
          buffer_size: bufferSize,
        }),
      })

      if (!response.ok) {
        throw new Error("Erreur lors de la communication avec l'API FastAPI.")
      }

      const data: ChunkResponse = await response.json()
      setResult(data)
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.")
    } finally {
      setLoading(false)
    }
  }

  const maxDistance = result?.distances.length
    ? Math.max(...result.distances, result.threshold_value)
    : 1

  return (
    <div className="min-h-screen bg-background p-6 text-foreground md:p-10">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Scissors className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight">
                Semantic Chunking Studio
              </h1>
            </div>
            <p className="mt-1 text-muted-foreground">
              Visualisez les ruptures thématiques par distance cosinus
              (all-MiniLM-L6-v2).
            </p>
          </div>
          <Badge variant="outline" className="w-fit px-3 py-1 text-sm">
            Module 2.2 • RAG Avancé
          </Badge>
        </div>

        <Separator />

        {/* Grille Principale */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Colonne Gauche : Entrée et Hyperparamètres */}
          <div className="space-y-6 lg:col-span-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">1. Document Source</CardTitle>
                <CardDescription>
                  Collez un texte contenant plusieurs changements de sujets.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={8}
                  placeholder="Entrez votre texte ici..."
                  className="resize-none leading-relaxed"
                />

                <div className="space-y-4 pt-2">
                  {/* Slider Percentile */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Seuil de Percentile</span>
                      <Badge variant="secondary">
                        {percentile}e percentile
                      </Badge>
                    </div>
                    <Slider
                      value={[percentile]}
                      min={50}
                      max={99}
                      step={1}
                      onValueChange={(val) => setPercentile(val[0])}
                    />
                    <p className="text-xs text-muted-foreground">
                      Plus le percentile est bas, plus le texte est découpé en
                      petits chunks.
                    </p>
                  </div>

                  {/* Slider Buffer */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">
                        Fenêtre de contexte (Buffer)
                      </span>
                      <Badge variant="secondary">
                        ± {bufferSize} phrase(s)
                      </Badge>
                    </div>
                    <Slider
                      value={[bufferSize]}
                      min={0}
                      max={3}
                      step={1}
                      onValueChange={(val) => setBufferSize(val[0])}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleAnalyze}
                  disabled={loading || text.trim().length < 10}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Calcul des embeddings...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Exécuter le Découpage Sémantique
                    </>
                  )}
                </Button>

                {error && (
                  <p className="text-sm font-medium text-destructive">
                    {error}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Colonne Droite : Visualisation et Résultats */}
          <div className="space-y-6 lg:col-span-7">
            {/* Graphique des distances cosinus */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">
                      Distances Cosinus Inter-Phrases
                    </CardTitle>
                  </div>
                  {result && (
                    <Badge variant="destructive">
                      Seuil de coupure : {result.threshold_value}
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  Les barres dépassant le seuil déclenchent une nouvelle
                  frontière de chunk.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!result ? (
                  <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                    Lancez l&apos;analyse pour visualiser les sauts sémantiques.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative flex h-44 items-end gap-3 rounded-lg border bg-muted/20 px-4 pt-6 pb-2">
                      {/* Ligne du seuil */}
                      <div
                        className="pointer-events-none absolute right-0 left-0 z-10 border-t-2 border-dashed border-destructive"
                        style={{
                          bottom: `${(result.threshold_value / maxDistance) * 80 + 10}%`,
                        }}
                      />

                      {result.distances.map((dist, idx) => {
                        const isBreakpoint = dist > result.threshold_value
                        const heightPct = Math.max((dist / maxDistance) * 80, 8)
                        return (
                          <div
                            key={idx}
                            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                          >
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {dist.toFixed(2)}
                            </span>
                            <div
                              className={`w-full max-w-[44px] rounded-t-md transition-all ${
                                isBreakpoint
                                  ? "bg-destructive"
                                  : "bg-primary/75"
                              }`}
                              style={{ height: `${heightPct}%` }}
                              title={`Transition P${idx + 1} -> P${idx + 2} : ${dist}`}
                            />
                            <span className="text-[10px] text-muted-foreground">
                              P{idx + 1}→P{idx + 2}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Liste des Chunks générés */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">
                      Chunks Sémantiques Générés
                    </CardTitle>
                  </div>
                  {result && (
                    <Badge variant="outline">
                      {result.chunks.length} chunk(s)
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!result ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun chunk généré pour le moment.
                  </p>
                ) : (
                  result.chunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      className="space-y-2 rounded-lg border bg-card p-4 transition-colors hover:border-primary/50"
                    >
                      <div className="flex items-center justify-between">
                        <Badge>Chunk #{chunk.id}</Badge>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span>{chunk.sentence_count} phrase(s)</span>
                          <span>•</span>
                          <span>{chunk.text.length} caractères</span>
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed">{chunk.text}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
