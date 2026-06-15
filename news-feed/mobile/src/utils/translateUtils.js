import { AI_BASE_URL } from "./aiFetch";

export async function translateText(text, sourceLang, targetLang) {
  if (!text || !text.trim()) return "";
  try {
    const res = await fetch(`${AI_BASE_URL}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, source_lang: sourceLang, target_lang: targetLang }),
    });
    if (!res.ok) throw new Error(`Translation failed: ${res.status}`);
    const data = await res.json();
    const translated = (data.translatedText || "").trim();
    if (!translated || /^(i can'?t|cannot|sorry|i'm sorry|i will not|cannot fulfill)/i.test(translated)) {
      return text;
    }
    return translated;
  } catch {
    return text;
  }
}
