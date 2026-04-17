from __future__ import annotations

from typing import Tuple
from urllib.parse import urlparse
import importlib.util
import requests
from bs4 import BeautifulSoup


class VvAdapter:
    def __init__(self, vv_py_path: str | None, timeout_seconds: int = 30) -> None:
        self._timeout_seconds = timeout_seconds
        self._process_url = None

        if vv_py_path:
            spec = importlib.util.spec_from_file_location("vv_module", vv_py_path)
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                self._process_url = getattr(module, "process_url", None)

    def classify(self, url: str) -> Tuple[str, str, str]:
        if self._process_url is not None:
            result, text, pattern, _ = self._process_url(url)
            return str(result).upper(), text or "", pattern or ""

        # Fallback lightweight classifier if VV.py path is not configured.
        response = requests.get(url, timeout=self._timeout_seconds)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        text = " ".join(soup.stripped_strings)
        if len(text) > 400:
            return "ARTICLE", text[:20000], "fallback-text-length"
        return "LISTING", "", "fallback-text-length"


def same_host(url_a: str, url_b: str) -> bool:
    return urlparse(url_a).netloc.lower() == urlparse(url_b).netloc.lower()
