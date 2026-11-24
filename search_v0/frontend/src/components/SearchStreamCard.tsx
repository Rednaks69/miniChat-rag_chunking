"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Play, CheckCircle2, AlertCircle } from "lucide-react";
import { SearchEngineType, SearchResultItem } from "@/types/search";

interface SearchStreamCardProps {
  title: string;
  subtitle: string;
  engine: SearchEngineType;
  badgeLabel: string;
  results: SearchResultItem[];
  statusMessage: string;
  isStreaming: boolean;
  error: string | null;
  onTriggerSingle: (engine: SearchEngineType) => void;
  disabled: boolean;
}

export function SearchStreamCard({
  title,
  subtitle,
  engine,
  badgeLabel,
  results,
  statusMessage,
  isStreaming,
  error,
  onTriggerSingle,
  disabled,
}: SearchStreamCardProps) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={engine === "rrf" ? "default" : "secondary"}>
            {badgeLabel}
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onTriggerSingle(engine)}
            disabled={disabled || isStreaming}
            className="h-7 px-2 text-xs">
            {isStreaming ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <Play className="h-3.5 w-3.5 mr-1" />
            )}
            Lancer seul
          </Button>
        </div>
        <CardTitle className="text-lg pt-1">{title}</CardTitle>
        <CardDescription className="text-xs">{subtitle}</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between space-y-4">
        {/* Barre d'état du flux SSE */}
        <div className="min-h-7 flex items-center text-xs">
          {error ? (
            <div className="flex items-center gap-1.5 text-destructive font-medium">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : isStreaming ? (
            <div className="flex items-center gap-1.5 text-primary font-medium">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              <span>{statusMessage || "Connexion au flux SSE..."}</span>
            </div>
          ) : results.length > 0 ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>Flux SSE terminé ({results.length} résultats)</span>
            </div>
          ) : (
            <span className="text-muted-foreground">
              En attente d&apos;une requête...
            </span>
          )}
        </div>

        {/* Liste des résultats streamés */}
        <div className="space-y-2.5 flex-1">
          {results.length === 0 && !isStreaming ? (
            <div className="h-44 border border-dashed rounded-lg flex items-center justify-center text-xs text-muted-foreground p-4 text-center">
              Aucun document reçu sur ce canal SSE.
            </div>
          ) : (
            results.map((item, idx) => {
              const displayRank = item.final_rank ?? item.rank ?? idx + 1;
              return (
                <div
                  key={`${engine}-${item.doc_id}-${idx}`}
                  className="p-3 rounded-lg border bg-card hover:border-primary/40 transition-all space-y-1.5 animate-in fade-in slide-in-from-bottom-1 duration-200">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={displayRank === 1 ? "default" : "outline"}
                        className="text-xs">
                        Rang #{displayRank}
                      </Badge>
                      <span className="text-xs font-mono text-muted-foreground">
                        Doc #{item.doc_id}
                      </span>
                    </div>

                    {item.cosine_score !== undefined && (
                      <Badge
                        variant="secondary"
                        className="font-mono text-[11px]">
                        Cosinus: {item.cosine_score.toFixed(4)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed">{item.content}</p>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
