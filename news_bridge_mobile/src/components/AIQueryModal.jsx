import React, { useState, useCallback } from "react";
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
} from "react-native";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/colors";
import { apiClient } from "../api/apiClient";

const AI_BASE_URL = "http://10.0.2.2:8000"; // AI assistant service

export default function AIQueryModal({ post, visible, onClose }) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAsk = useCallback(async () => {
    const q = question.trim();
    if (!q) return;

    setLoading(true);
    setError("");
    setAnswer(null);

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
      setAnswer(data.answer || "No answer generated.");
    } catch (err) {
      console.error("AI query error:", err.message);
      setError(err.message || "Failed to contact AI service.");
    } finally {
      setLoading(false);
    }
  }, [question, post.id, post.tags]);

  const resetAndClose = () => {
    setQuestion("");
    setAnswer(null);
    setError("");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetAndClose}>
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={resetAndClose}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>🤖 {t("askAI")}</Text>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Post context */}
          {post?.title && (
            <View style={styles.postContext}>
              <Text style={styles.postContextLabel}>{t("selectedPost")}</Text>
              <Text style={styles.postContextTitle}>{post.title}</Text>
            </View>
          )}

          {/* Answer area */}
          {loading && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.brand} />
              <Text style={styles.loadingText}>{t("aiThinking")}</Text>
            </View>
          )}

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {answer && !loading ? (
            <View style={styles.answerBox}>
              <Text style={styles.answerLabel}>{t("answer")}</Text>
              <Text style={styles.answerText}>{answer}</Text>
            </View>
          ) : null}

          {/* Question input area */}
          <View style={styles.inputArea}>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder={t("askPlaceholder")}
              placeholderTextColor={colors.muted}
              style={styles.questionInput}
              multiline
              editable={!loading}
            />
            <TouchableOpacity
              onPress={handleAsk}
              style={[styles.askBtn, (!question.trim() || loading) && styles.askBtnDisabled]}
              disabled={!question.trim() || loading}
            >
              <Text style={styles.askBtnText}>{t("ask")}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  modalClose: {
    fontSize: 22,
    color: colors.text,
    fontWeight: "700",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  postContext: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  postContextLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  postContextTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  center: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    color: colors.muted,
    fontWeight: "700",
  },
  errorBanner: {
    backgroundColor: "#fff0f0",
    borderWidth: 1,
    borderColor: "#f2b8b8",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    color: "#9d3f3f",
    fontWeight: "600",
    fontSize: 13,
  },
  answerBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderLeftWidth: 4,
    borderLeftColor: colors.brand,
  },
  answerLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brand,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  answerText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  questionInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
    maxHeight: 100,
    minHeight: 44,
  },
  askBtn: {
    backgroundColor: colors.brand,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: "center",
  },
  askBtnDisabled: {
    opacity: 0.5,
  },
  askBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
});