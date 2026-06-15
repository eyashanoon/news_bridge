"""LLM generation via Ollama (llama3.2:3b).

All generation goes through the Ollama local API.
Supports dynamic system prompts and temperature configuration.
"""

import logging
import httpx
from typing import Optional

from config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a helpful news assistant for the News Bridge platform. "
    "Answer questions concisely based on the provided context. "
    "Cite sources by article title when possible. "
    "Respond in the same language as the user's query."
)


class LLM:
    """Wrapper around Ollama's chat completion API."""

    def __init__(self) -> None:
        self.base_url = settings.ollama_base_url
        self.model = settings.llm_model
        self.default_temperature = settings.llm_temperature

    def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: Optional[float] = None,
    ) -> str:
        """Send a chat prompt and return the model's text response."""
        logger.info("LLM PROMPT (first 500 chars): %s", prompt[:500])
        logger.info("LLM system: %s", (system or SYSTEM_PROMPT)[:200])
        logger.info("LLM temperature: %s", temperature if temperature is not None else self.default_temperature)

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system or SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "options": {
                "temperature": temperature if temperature is not None else self.default_temperature,
            },
            "stream": False,
        }
        resp = httpx.post(
            f"{self.base_url}/api/chat",
            json=payload,
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        answer = data["message"]["content"]
        logger.info("LLM ANSWER (first 500 chars): %s", answer[:500])
        return answer

    def is_available(self) -> bool:
        """Check if the Ollama service is reachable."""
        try:
            r = httpx.get(f"{self.base_url}/api/tags", timeout=5)
            return r.status_code == 200
        except Exception:
            return False