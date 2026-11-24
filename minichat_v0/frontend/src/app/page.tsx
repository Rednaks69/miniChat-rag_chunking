"use client";

import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a concise, witty assistant.",
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMsg];

    setMessages([...updatedMessages, { role: "assistant", content: "" }]);
    setInput("");
    setIsStreaming(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          messages: updatedMessages,
        }),
      });

      if (!response.body) throw new Error("No response stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);

          if (payload === "[DONE]") break;

          const parsed = JSON.parse(payload);
          if (parsed.text) {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              next[next.length - 1] = {
                ...last,
                content: last.content + parsed.text,
              };
              return next;
            });
          }
        }
      }
    } catch (err) {
      console.error("Stream error:", err);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col p-4 gap-4">
      {/* Editable System Prompt */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold uppercase text-gray-500">
          System Prompt
        </label>
        <textarea
          rows={2}
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          className="w-full rounded border p-2 text-sm"
          placeholder="Set Gemini's behavior..."
        />
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto rounded border p-4 space-y-3">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`rounded p-3 text-sm whitespace-pre-wrap ${
              m.role === "user"
                ? "ml-auto max-w-[80%] bg-blue-600 text-white"
                : "mr-auto max-w-[80%] bg-gray-100 text-gray-900"
            }`}>
            {m.content ||
              (isStreaming && idx === messages.length - 1 ? "..." : "")}
          </div>
        ))}
      </div>

      {/* Message Input */}
      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Gemini..."
          className="flex-1 rounded border px-3 py-2 text-sm"
          disabled={isStreaming}
        />
        <button
          type="submit"
          disabled={isStreaming}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          Send
        </button>
      </form>
    </main>
  );
}
