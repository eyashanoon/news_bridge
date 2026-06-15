// ChatWidget.jsx
import { useEffect, useRef, useState } from "react";
import { aiFetch } from "../utils/aiFetch";
import { useTranslation } from "react-i18next";

export default function ChatWidget({ category, selectedPost }) {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: t("chatTitle") + ". " + t("chatSubtitle") + ".",
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
          content: `${t("selectedPost")} "${selectedPost.title}".\n\n${t("askPlaceholder")}`,
        },
      ]);
    } else {
      setMessages([
        {
          role: "assistant",
          content: t("chatTitle") + ". " + t("chatSubtitle") + ".",
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
          postId: postId,
          tags: tags,
          language: i18n.language,
          top_k: 5,
        }),
      });

      if (!res.ok) throw new Error("AI service failed");

      const data = await res.json();

      const answer = data.answer || t("aiThinking");
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
          content: t("aiUnavailable"),
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
    <div className="chat-widget">
      <div className="chat-container">
        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-info">
            <div className="chat-header-title">
              <span>🤖</span>
              <span>{t("aiAssistant")}</span>
            </div>
            <div className="chat-header-subtitle">
              {selectedPost
                ? `${t("selectedPost")} ${selectedPost.label} (Post #${selectedPost.id})`
                : `${t("category_General")}: ${category}`}
            </div>
          </div>

          {selectedPost && (
            <span className="chat-header-badge">{t("postMode") || "Post Mode"}</span>
          )}
        </div>

        {/* Chat Messages */}
        <div className="chat-messages">
          {messages.map((m, idx) => (
            <div key={idx} className={`chat-msg ${m.role}`}>
              <div className="chat-bubble">{m.content}</div>
            </div>
          ))}

          {loading && (
            <div className="chat-msg assistant thinking">
              <div className="chat-bubble">{t("aiThinking")}</div>
            </div>
          )}

          <div ref={bottomRef}></div>
        </div>

        {/* Input */}
        <div className="chat-input-area">
          <div className="chat-input-row">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedPost
                  ? t("askPlaceholder")
                  : `${t("askPlaceholder")} ${category}...`
              }
              rows={2}
            />

            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="chat-send-btn"
            >
              {loading ? t("aiThinking") : t("send")}
            </button>
          </div>

          <div className="chat-tip">
            Tip: Enter to send, Shift+Enter for new line.
          </div>
        </div>
      </div>
    </div>
  );
}