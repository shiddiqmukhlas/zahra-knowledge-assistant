"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, Trash2, User } from "lucide-react";
import BeyondPresenceEmbed from "@/components/BeyondPresenceEmbed";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const SESSION_KEY = "arunika-session-id";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function TypingIndicator() {
  return (
    <div className="flex gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="typing-dot h-2 w-2 rounded-full bg-slate-400"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, sessionId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Request failed");
      }

      if (data.sessionId) {
        sessionStorage.setItem(SESSION_KEY, data.sessionId);
        setSessionId(data.sessionId);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply,
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    const newId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, newId);
    setSessionId(newId);
  };

  return (
    <div className="flex h-dvh flex-col bg-[var(--bg-primary)]">
      <header className="flex shrink-0 items-center justify-between border-b border-white/8 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Arunika</h1>
            <p className="text-xs text-slate-500">Langflow chat · Beyond Presence avatar</p>
          </div>
        </div>
        <button
          type="button"
          onClick={clearChat}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
          title="Clear chat"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="h-[42vh] shrink-0 border-b border-white/8 lg:h-auto lg:w-[min(440px,42%)] lg:shrink-0 lg:border-b-0 lg:border-r">
          <BeyondPresenceEmbed />
        </aside>

        <main className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 && !isLoading && (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <Bot className="h-8 w-8 text-slate-600" />
                <p className="max-w-xs text-sm text-slate-500">
                  Chat teks lewat Langflow. Avatar & suara lewat panel Beyond Presence.
                </p>
              </div>
            )}

            <div className="mx-auto flex max-w-2xl flex-col gap-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      msg.role === "user"
                        ? "bg-blue-500"
                        : "bg-gradient-to-br from-blue-600 to-cyan-500"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <User className="h-3.5 w-3.5 text-white" />
                    ) : (
                      <Bot className="h-3.5 w-3.5 text-white" />
                    )}
                  </div>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "chat-bubble-user text-white"
                        : "chat-bubble-ai text-slate-200"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500">
                    <Bot className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="chat-bubble-ai">
                    <TypingIndicator />
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          </div>

          {error && (
            <div className="mx-4 mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="shrink-0 border-t border-white/8 px-4 py-3">
            <form
              className="mx-auto flex max-w-2xl items-center gap-2 rounded-2xl border border-white/8 bg-white/4 px-4 py-2"
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ketik pesan ke Langflow..."
                disabled={isLoading}
                className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 disabled:opacity-30"
              >
                <Send className="h-3.5 w-3.5 text-white" />
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
