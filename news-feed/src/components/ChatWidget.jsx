// ChatWidget.jsx
import { useEffect, useRef, useState } from "react";
import { aiFetch } from "../utils/aiFetch";

export default function ChatWidget({ category, selectedPost }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I'm your AI news assistant. Ask me anything about the latest news.",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (selectedPost) {
      setMessages([
        {
          role: "assistant",
          content: `You're asking about this post: "${selectedPost.title}".\n\nAsk your question and I will answer using this post as context.`,
        },
      ]);
    } else {
      setMessages([
        {
          role: "assistant",
          content:
            "Hi! I'm your AI news assistant. Ask me anything about the latest news.",
        },
      ]);
    }
  }, [selectedPost]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");

    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      setLoading(true);

      const tags = selectedPost?.tags || [];
      const postId = selectedPost?.id || null;

      const res = await aiFetch("/query", {
        method: "POST",
        body: JSON.stringify({
          question: userMessage,
          postId: postId,   // ✅ IMPORTANT FIX
          tags: tags,
          top_k: 5,
        }),
      });

      if (!res.ok) throw new Error("AI service failed");

      const data = await res.json();

      const answer = data.answer || "No answer returned.";
      const sources = Array.isArray(data.sources) ? data.sources : [];

      let sourcesText = "";
      if (sources.length > 0) {
        const unique = [];
        const seen = new Set();

        for (const s of sources) {
          const key = `${s.postId}-${s.tag}`;
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(s);
          }
        }

        sourcesText =
          "\n\nSources:\n" +
          unique
            .slice(0, 4)
            .map((s) => `• Post #${s.postId}${s.tag ? ` (${s.tag})` : ""}`)
            .join("\n");
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: answer + sourcesText },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, the AI service is currently unavailable.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="p-3">
      <div className="bg-white rounded-2xl shadow border flex flex-col h-[520px] overflow-hidden">
        {/* Header */}
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-gray-500 hover:text-gray-800"
        >
          Clear
        </button>

        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <div className="font-bold text-gray-800 flex items-center gap-2">
              🤖 AI Assistant
            </div>
            <div className="text-xs text-gray-500">
              {selectedPost
                ? `Context: ${selectedPost.label} post (Post #${selectedPost.id})`
                : `Category: ${category}`}
            </div>
          </div>

          {selectedPost && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">
              Post Mode
            </span>
          )}
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm whitespace-pre-line shadow-sm ${
                  m.role === "user"
                    ? "bg-blue-600 text-white rounded-br-md"
                    : "bg-white text-gray-800 rounded-bl-md border"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border px-4 py-2 rounded-2xl text-sm shadow-sm text-gray-500 animate-pulse">
                Thinking...
              </div>
            </div>
          )}

          <div ref={bottomRef}></div>
        </div>

        {/* Input */}
        <div className="p-3 border-t bg-white">
          <div className="flex items-center gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedPost
                  ? "Ask something about this post..."
                  : `Ask about ${category} news...`
              }
              className="flex-1 resize-none border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
              rows={2}
            />

            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className={`px-4 py-2 rounded-xl font-semibold text-sm transition ${
                loading || !input.trim()
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              Send
            </button>
          </div>

          <div className="text-[11px] text-gray-400 mt-2">
            Tip: Press Enter to send, Shift+Enter for new line.
          </div>
        </div>
      </div>
    </div>
  );
}