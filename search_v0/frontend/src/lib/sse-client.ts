import {
  SearchEngineType,
  SearchResultItem,
  SSEEventPayload,
} from "@/types/search";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface StreamSearchOptions {
  engine: SearchEngineType;
  query: string;
  corpus: string[];
  topK: number;
  signal: AbortSignal;
  onStatus: (statusMessage: string) => void;
  onResult: (item: SearchResultItem) => void;
  onDone: () => void;
  onError: (errorMessage: string) => void;
}

export async function streamSearchEngine({
  engine,
  query,
  corpus,
  topK,
  signal,
  onStatus,
  onResult,
  onDone,
  onError,
}: StreamSearchOptions): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/stream/${engine}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        corpus,
        top_k: topK,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(
        `Erreur serveur (${response.status}) sur /stream/${engine}`,
      );
    }

    if (!response.body) {
      throw new Error("Le flux SSE est vide.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const event of events) {
        if (!event.startsWith("data: ")) continue;

        const rawPayload = event.replace("data: ", "").trim();
        if (rawPayload === "[DONE]") {
          onDone();
          return;
        }

        const parsed: SSEEventPayload = JSON.parse(rawPayload);
        if (parsed.type === "status" && parsed.message) {
          onStatus(parsed.message);
        } else if (parsed.type === "result" && parsed.item) {
          onResult(parsed.item);
        }
      }
    }

    onDone();
  } catch (err: any) {
    if (err.name === "AbortError") return;
    onError(err.message || "Erreur de connexion au flux SSE.");
  }
}
