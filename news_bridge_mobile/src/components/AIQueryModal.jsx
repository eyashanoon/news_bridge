import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { useTranslation } from "react-i18next";
import { colors, darkColors } from "../theme/colors";
import { useTheme } from "../context/ThemeContext";

const AI_BASE_URL = "http://10.0.2.2:9000"; // AI assistant service (matches PostCard.jsx and web version)

export default function AIQueryModal({ post, visible, onClose }) {
  const { t } = useTranslation();
  const { darkMode } = useTheme();
  const themeColors = darkMode ? darkColors : colors;

  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  // Reset messages when post changes or modal opens
  useEffect(() => {
    if (visible && post) {
      setMessages([
        {
          role: "ai",
          text: `Ask me anything about this article: "${post.title || "Untitled"}"`,
          id: "welcome",
        },
      ]);
    }
  }, [visible, post?.id]);

  const handleAsk = useCallback(async () => {
    const q = question.trim();
    if (!q || loading) return;

    // Add user message
    const userMsg = { role: "user", text: q, id: `user_${Date.now()}` };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setLoading(true);

    // Add placeholder AI message
    const aiMsgId = `ai_${Date.now()}`;
    setMessages((prev) => [...prev, { role: "ai", text: "", id: aiMsgId, loading: true }]);

    try {
      // First ensure the post is ingested
      try {
        await fetch(`${AI_BASE_URL}/ingest/post/${post.id}`, { method: "POST" });
      } catch {
        // Ingestion may already have been done, so ignore
      }

      // Send the query
      const res = await fetch(`${AI_BASE_URL}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          postId: post.id,
          tags: post.tags || [],
          top_k: 5,
        }),
      });

      if (!res.ok) {
        throw new Error(`AI service responded: ${res.status}`);
      }

      const data = await res.json();
      const answer = data.answer || "No answer generated.";

      // Update the AI message with the actual answer
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMsgId ? { ...msg, text: answer, loading: false } : msg
        )
      );
    } catch (err) {
      console.error("AI query error:", err.message);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMsgId
            ? { ...msg, text: `Error: ${err.message}`, loading: false, isError: true }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  }, [question, post.id, post.tags, loading]);

  const resetAndClose = () => {
    setMessages([]);
    setQuestion("");
    setLoading(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetAndClose}>
      <KeyboardAvoidingView
        style={[styles.modalContainer, { backgroundColor: themeColors.bg }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={[styles.modalHeader, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.borderLight }]}>
          <TouchableOpacity onPress={resetAndClose} style={[styles.closeBtn, { borderColor: themeColors.borderLight }]}>
            <Text style={[styles.closeBtnText, { color: themeColors.text }]}>✕</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>🤖 {t("askAI")}</Text>
            {post?.title && (
              <Text style={[styles.headerSubtitle, { color: themeColors.muted }]} numberOfLines={1}>
                {post.title.length > 40 ? post.title.slice(0, 40) + "..." : post.title}
              </Text>
            )}
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.messageRow,
                msg.role === "user" ? styles.userRow : styles.aiRow,
              ]}
            >
              {/* Avatar */}
              {msg.role === "ai" && (
                <View style={[styles.avatar, { backgroundColor: themeColors.brand + "20" }]}>
                  <Text style={[styles.avatarText]}>🤖</Text>
                </View>
              )}

              {/* Bubble */}
              <View
                style={[
                  styles.bubble,
                  msg.role === "user"
                    ? [styles.userBubble, { backgroundColor: themeColors.brand }]
                    : [styles.aiBubble, { backgroundColor: darkMode ? "#1e293b" : "#f1f5f9", borderColor: themeColors.borderLight }],
                  msg.isError && styles.errorBubble,
                ]}
              >
                {msg.loading ? (
                  <View style={styles.thinkingRow}>
                    <ActivityIndicator size="small" color={themeColors.brand} />
                    <Text style={[styles.thinkingText, { color: themeColors.muted }]}>Thinking...</Text>
                  </View>
                ) : (
                  <Text
                    style={[
                      styles.bubbleText,
                      msg.role === "user"
                        ? { color: "#fff" }
                        : { color: themeColors.text },
                      msg.isError && { color: themeColors.error },
                    ]}
                  >
                    {msg.text}
                  </Text>
                )}
              </View>

              {/* User avatar */}
              {msg.role === "user" && (
                <View style={[styles.avatar, { backgroundColor: themeColors.brand }]}>
                  <Text style={styles.avatarText}>👤</Text>
                </View>
              )}
            </View>
          ))}

          {/* Post context card as first interaction hint */}
          {messages.length <= 1 && post?.text && (
            <View style={[styles.contextCard, { backgroundColor: darkMode ? "#1e293b" : "#f8faff", borderColor: themeColors.borderLight }]}>
              <Text style={[styles.contextLabel, { color: themeColors.muted }]}>Article preview</Text>
              <Text style={[styles.contextText, { color: themeColors.textSecondary }]} numberOfLines={4}>
                {post.text.slice(0, 200)}...
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Input area */}
        <View style={[styles.inputArea, { backgroundColor: themeColors.surface, borderTopColor: themeColors.borderLight }]}>
          <View style={[styles.inputRow, { backgroundColor: themeColors.bg, borderColor: themeColors.borderLight }]}>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder={t("askPlaceholder") || "Ask about this article..."}
              placeholderTextColor={themeColors.muted}
              style={[styles.questionInput, { color: themeColors.text }]}
              multiline
              editable={!loading}
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={handleAsk}
            />
            <TouchableOpacity
              onPress={handleAsk}
              style={[
                styles.sendBtn,
                { backgroundColor: question.trim() && !loading ? themeColors.brand : themeColors.muted + "40" },
              ]}
              disabled={!question.trim() || loading}
            >
              <Text style={styles.sendBtnText}>➤</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: "600",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
    maxWidth: "80%",
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: 14,
    alignItems: "flex-end",
    gap: 8,
  },
  userRow: {
    justifyContent: "flex-end",
  },
  aiRow: {
    justifyContent: "flex-start",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
  },
  bubble: {
    maxWidth: "75%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  errorBubble: {
    borderColor: "#fca5a5",
    backgroundColor: "#fef2f2",
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  thinkingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  thinkingText: {
    fontSize: 14,
    fontWeight: "600",
  },
  contextCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  contextLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  contextText: {
    fontSize: 13,
    lineHeight: 18,
  },
  inputArea: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 24,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderWidth: 1,
    borderRadius: 20,
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 4,
  },
  questionInput: {
    flex: 1,
    fontSize: 15,
    maxHeight: 80,
    minHeight: 36,
    paddingVertical: 6,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
  },
  sendBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});