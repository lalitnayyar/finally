"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage, ChatResponse } from "../types";

interface ChatPanelProps {
  onAction: () => void;
}

const VALID_TICKER = /^[A-Z]{1,5}$/;

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")   // **bold** → bold
    .replace(/\*(.+?)\*/g, "$1")        // *italic* → italic
    .replace(/^#{1,6}\s+/gm, "")        // ## headings
    .replace(/^[-*+]\s+/gm, "• ")       // - bullets → • bullets
    .replace(/`(.+?)`/g, "$1")          // `code` → code
    .trim();
}

export default function ChatPanel({ onAction }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [inputLocked, setInputLocked] = useState(true);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInput("");
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data: ChatResponse = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.message,
          trades: data.trades,
          watchlist_changes: data.watchlist_changes,
        },
      ]);

      if (data.trades.length > 0 || data.watchlist_changes.length > 0) {
        onAction();
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-4 right-4 bg-accent-yellow text-bg-primary font-bold text-sm px-3 py-2 rounded-lg shadow-lg hover:opacity-90 z-50"
      >
        AI Chat
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full border-l border-border bg-bg-card">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-semibold text-accent-yellow">AI Assistant</span>
        <button onClick={() => setCollapsed(true)} className="text-text-secondary hover:text-text-primary text-xs">
          Hide
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-text-secondary text-xs text-center mt-4">
            Ask about your portfolio, request analysis, or tell me to make trades.
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`text-xs ${msg.role === "user" ? "text-right" : "text-left"}`}>
            <div className={`inline-block max-w-[90%] rounded-lg px-3 py-2 ${
              msg.role === "user"
                ? "bg-blue-primary text-white"
                : "bg-bg-primary text-text-primary border border-border"
            }`}>
              <p className="whitespace-pre-wrap">{stripMarkdown(msg.content)}</p>
              {msg.trades && msg.trades.filter(t => VALID_TICKER.test(t.ticker.toUpperCase())).length > 0 && (
                <div className="mt-2 pt-1 border-t border-border">
                  {msg.trades.filter(t => VALID_TICKER.test(t.ticker.toUpperCase())).map((t, j) => (
                    <p key={j} className="text-accent-yellow text-[10px]">
                      {t.side.toUpperCase()} {t.quantity} {t.ticker.toUpperCase()}
                    </p>
                  ))}
                </div>
              )}
              {msg.watchlist_changes && msg.watchlist_changes.filter(w => VALID_TICKER.test(w.ticker.toUpperCase())).length > 0 && (
                <div className="mt-1">
                  {msg.watchlist_changes.filter(w => VALID_TICKER.test(w.ticker.toUpperCase())).map((w, j) => (
                    <p key={j} className="text-blue-primary text-[10px]">
                      {w.action === "add" ? "+" : "-"} {w.ticker.toUpperCase()} watchlist
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-text-secondary text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-yellow animate-pulse" />
            Thinking...
          </div>
        )}
      </div>
      <form
        className="p-2 border-t border-border"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
      >
        <input
          type="text"
          name="email"
          autoComplete="off"
          tabIndex={-1}
          aria-hidden
          className="absolute h-0 w-0 overflow-hidden opacity-0 pointer-events-none"
          readOnly
        />
        <div className="flex gap-1">
          <input
            type="text"
            name="finally-chat-message"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            readOnly={inputLocked}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setInputLocked(false)}
            placeholder={inputLocked ? "Click to type a message…" : "Ask your AI assistant…"}
            className="flex-1 bg-bg-primary border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-blue-primary"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-purple-secondary text-white text-xs px-3 py-1.5 rounded hover:opacity-80 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
