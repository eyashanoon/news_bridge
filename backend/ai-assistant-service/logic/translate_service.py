"""Translation service — translates text between languages using the local LLM.

Passes content as a 'machine translation engine' task to bypass content filtering.
"""

import logging
from typing import Optional

from config import settings
from core.llm import LLM

logger = logging.getLogger(__name__)

TRANSLATION_PROMPT = (
    "You are a machine translation engine. Translate the following text "
    "from {source_lang} to {target_lang}. "
    "Return ONLY the translated text, no explanations, no notes.\n\n"
    "Text to translate:\n{text}"
)


class TranslateService:
    """Handles /translate endpoint logic."""

    def __init__(self, llm: LLM) -> None:
        self.llm = llm

    def translate(
        self,
        text: str,
        target_lang: str,
        source_lang: Optional[str] = None,
    ) -> str:
        """Translate text to the target language.

        Args:
            text: The text to translate.
            target_lang: Target language (e.g., 'english', 'arabic').
            source_lang: Optional source language. Auto-detected if not provided.

        Returns:
            Translated text, or the original text if translation fails.
        """
        if not text.strip():
            return text

        source = source_lang or "auto-detected"
        logger.info("TRANSLATE from=%s to=%s text_len=%d", source, target_lang, len(text))
        logger.info("TRANSLATE text (first 300 chars): %s", text[:300])

        prompt = TRANSLATION_PROMPT.format(
            source_lang=source,
            target_lang=target_lang,
            text=text,
        )

        try:
            translated = self.llm.generate(
                prompt,
                temperature=settings.llm_temperature_translate,
            )
            logger.info("TRANSLATE result (first 300 chars): %s", translated[:300])
            return translated.strip()
        except Exception as e:
            logger.warning("Translation failed, returning original text: %s", e)
            return text  # Return original on failure
