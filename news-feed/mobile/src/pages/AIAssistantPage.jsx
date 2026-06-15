import { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import TopBar from "../components/TopBar";
import { useTheme } from "../context/ThemeContext";
import { categoryTheme } from "../utils/categoryColors";
import { API_CONFIG } from "../api/config";
import { dark as dc, th } from "../utils/darkColors";
import { useTranslation } from "react-i18next";

const AI_PORT = 9000;
const AI_BASE_URL = `http://${API_CONFIG.host}:${AI_PORT}`;

export default function AIAssistantPage({ navigation, route }) {
  const { currentCategory, darkMode } = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const theme = categoryTheme[currentCategory]?.light || categoryTheme.General.light;

  const selectedPost = route?.params?.selectedPost || null;
  const initialCategory = route?.params?.category || currentCategory;

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `🤖 ${t("chatTitle")}\n\n${t("chatSubtitle")}`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (selectedPost) {
      const postTitle = selectedPost.title || selectedPost.label || (lang === "ar" ? "منشور" : "a post");
      setMessages([
        {
          role: "assistant",
          content: lang === "ar"
            ? `أنت تسأل عن "${postTitle}".\n\nلا تتردد في سؤالي عن أي شيء يتعلق بهذا المنشور أو المواضيع ذات الصلة!`
            : `You're asking about "${postTitle}".\n\nFeel free to ask me anything about this post or related topics!`,
        },
      ]);
    } else {
      setMessages([
        {
          role: "assistant",
          content: lang === "ar"
            ? "🤖 مرحباً بك في مساعد أخبار بريدج!\n\nيمكنني مساعدتك في العثور على المعلومات، وتلخيص المقالات، والأسئلة حول الأخبار الجارية.\n\nاسألني أي شيء!"
            : "🤖 Welcome to the NewsBridge AI Assistant!\n\nI can help you find information, summarize articles, and answer questions about current news.\n\nAsk me anything!",
        },
      ]);
    }
  }, [selectedPost, lang, t]);

  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      setLoading(true);

      const tags = selectedPost?.tags || [];
      const postId = selectedPost?.id || null;

      const res = await fetch(`${AI_BASE_URL}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMessage,
          postId: postId,
          tags: tags,
          language: lang,
          top_k: 5,
        }),
      });

      if (!res.ok) throw new Error("AI service failed");

      const data = await res.json();
      const answer = data.answer || (lang === "ar" ? "لا أزال أفكر في ذلك... دعني أحاول مرة أخرى." : "I'm still thinking about that... Let me try again.");

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
        sourcesText = "\n\n" + (lang === "ar" ? "المصادر:" : "Sources:") + "\n" + unique
          .slice(0, 4)
          .map((s) => `• ${lang === "ar" ? "منشور" : "Post"} #${s.postId}${s.tag ? ` (${s.tag})` : ""}`)
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
          content: lang === "ar"
            ? "⚠️ عذراً، المساعد الذكي غير متاح حالياً. يرجى المحاولة مرة أخرى لاحقاً."
            : "⚠️ Sorry, the AI assistant is currently unavailable. Please try again later.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const isRtl = i18n.language === "ar";

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: th(darkMode, dc.bg, theme.bg), direction: isRtl ? "rtl" : "ltr" }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <TopBar navigation={navigation} />

      {/* Chat Header */}
      <View style={[styles.chatHeader, { backgroundColor: th(darkMode, dc.surface, "#ffffff"), borderBottomColor: th(darkMode, dc.border, "#e2e8f0") }]}>
        <View style={styles.chatHeaderLeft}>
          <Text style={[styles.chatHeaderTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>🤖 {t("aiAssistant")}</Text>
          <Text style={[styles.chatHeaderSubtitle, { color: th(darkMode, dc.muted, "#6e869a") }]}>
            {selectedPost
              ? `${lang === "ar" ? "وضع المنشور" : "Post Mode"}: ${selectedPost.label || (lang === "ar" ? "غير معروف" : "Unknown")} #${selectedPost.id}`
              : `${t("category")}: ${t(`category_${initialCategory}`, { defaultValue: initialCategory })}`}
          </Text>
        </View>
        {selectedPost && (
          <View style={styles.chatHeaderBadge}>
            <Text style={styles.chatHeaderBadgeText}>{lang === "ar" ? "وضع المنشور" : "Post Mode"}</Text>
          </View>
        )}
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messagesScroll}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((msg, idx) => (
          <View
            key={idx}
            style={[
              styles.messageBubble,
              msg.role === "user" ? styles.userBubble : [styles.assistantBubble, { backgroundColor: th(darkMode, dc.subtle, "#ffffff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }],
            ]}
          >
            <Text style={[styles.messageText, msg.role === "user" ? styles.userMessageText : [styles.assistantMessageText, { color: th(darkMode, dc.text, "#0b1a2b") }]]}>
              {msg.content}
            </Text>
          </View>
        ))}

        {loading && (
          <View style={[styles.messageBubble, styles.assistantBubble, { backgroundColor: th(darkMode, dc.subtle, "#ffffff") }]}>
            <Text style={[styles.assistantMessageText, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{lang === "ar" ? "💭 جاري التفكير..." : "💭 Thinking..."}</Text>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={[styles.inputArea, { backgroundColor: th(darkMode, dc.surface, "#ffffff"), borderTopColor: th(darkMode, dc.border, "#e2e8f0") }]}>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.textInput, { backgroundColor: th(darkMode, dc.subtle, "#f8fafc"), borderColor: th(darkMode, dc.border, "#e2e8f0"), color: th(darkMode, dc.text, "#0b1a2b") }]}
            value={input}
            onChangeText={setInput}
            placeholder={
              selectedPost
                ? `${lang === "ar" ? "اسأل عن" : "Ask about"} "${selectedPost.title || selectedPost.label || (lang === "ar" ? "هذا المنشور" : "this post")}"...`
                : `${lang === "ar" ? "اسأل عن" : "Ask about"} ${t(`category_${initialCategory}`, { defaultValue: initialCategory })}...`
            }
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={2}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={loading || !input.trim()}
          >
            <Text style={styles.sendBtnText}>{loading ? "..." : "➤"}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.chatTip}>{lang === "ar" ? "نصيحة: اضغط على إرسال للسؤال" : "Tip: Tap send to ask"}</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  chatHeaderLeft: { flex: 1 },
  chatHeaderTitle: { fontSize: 17, fontWeight: "700", color: "#0b1a2b" },
  chatHeaderSubtitle: { fontSize: 13, color: "#6e869a", marginTop: 2 },
  chatHeaderBadge: {
    backgroundColor: "#eff6ff",
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  chatHeaderBadgeText: { fontSize: 12, fontWeight: "600", color: "#2563eb" },

  messagesScroll: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 12 },

  messageBubble: {
    maxWidth: "82%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#2563eb",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderBottomLeftRadius: 4,
  },
  messageText: { fontSize: 15, lineHeight: 22 },
  userMessageText: { color: "#ffffff" },
  assistantMessageText: { color: "#0b1a2b" },

  inputArea: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 20,
  },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0b1a2b",
    maxHeight: 100,
    textAlignVertical: "center",
    backgroundColor: "#f8fafc",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#93c5fd" },
  sendBtnText: { fontSize: 20, color: "#ffffff", fontWeight: "600" },
  chatTip: { fontSize: 12, color: "#94a3b8", marginTop: 6, textAlign: "center" },
});