export type SearchEngineType = "bm25" | "dense" | "rrf";

export interface SearchResultItem {
  rank?: number;
  final_rank?: number;
  doc_id: number;
  cosine_score?: number;
  content: string;
}

export interface SSEEventPayload {
  type: "status" | "result";
  message?: string;
  engine?: SearchEngineType;
  item?: SearchResultItem;
}