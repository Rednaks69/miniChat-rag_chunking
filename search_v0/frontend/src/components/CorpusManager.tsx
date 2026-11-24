"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Database } from "lucide-react";

interface CorpusManagerProps {
  corpus: string[];
  onChangeCorpus: (newCorpus: string[]) => void;
}

export function CorpusManager({ corpus, onChangeCorpus }: CorpusManagerProps) {
  const [newDoc, setNewDoc] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newDoc.trim();
    if (!trimmed) return;
    onChangeCorpus([...corpus, trimmed]);
    setNewDoc("");
  };

  const handleRemove = (indexToRemove: number) => {
    if (corpus.length <= 1) return;
    onChangeCorpus(corpus.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">
              Base Documentaire (Corpus)
            </CardTitle>
          </div>
          <Badge variant="secondary">{corpus.length} document(s)</Badge>
        </div>
        <CardDescription>
          Ajoutez ou modifiez des documents contenant des codes exacts ou des
          synonymes pour observer la différence entre BM25, Google Embeddings et
          RRF.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            value={newDoc}
            onChange={(e) => setNewDoc(e.target.value)}
            placeholder="Ex: Le code SKU-8942B correspond au module de refroidissement liquide..."
          />
          <Button type="submit" variant="secondary" disabled={!newDoc.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
          {corpus.map((doc, idx) => (
            <div
              key={idx}
              className="flex items-start justify-between gap-2 p-2.5 rounded-md border bg-muted/30 text-sm">
              <div className="flex items-start gap-2">
                <Badge
                  variant="outline"
                  className="mt-0.5 shrink-0 font-mono text-xs">
                  #{idx}
                </Badge>
                <span className="leading-snug">{doc}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleRemove(idx)}
                disabled={corpus.length <= 1}
                title="Supprimer ce document">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
