"""Language detection and prompt helpers for bilingual (English/Arabic) responses."""

from typing import Optional


def normalize_language(language: Optional[str] = None, query: str = "") -> str:
    """Resolve response language to 'english' or 'arabic'."""
    if language:
        lang = language.strip().lower()
        if lang in ("ar", "arabic", "عربي", "العربية"):
            return "arabic"
        if lang in ("en", "english"):
            return "english"

    if query and _contains_arabic(query):
        return "arabic"
    return "english"


def _contains_arabic(text: str) -> bool:
    return any("\u0600" <= ch <= "\u06FF" for ch in text)


def response_language_instruction(language: str) -> str:
    """Prompt fragment enforcing the answer language regardless of source content."""
    if language == "arabic":
        return (
            "IMPORTANT: You MUST write your entire answer in Arabic. "
            "The news context below may be in English or Arabic — "
            "translate and summarize all relevant information into Arabic."
        )
    return (
        "IMPORTANT: You MUST write your entire answer in English. "
        "The news context below may be in English or Arabic — "
        "translate and summarize all relevant information into English."
    )
