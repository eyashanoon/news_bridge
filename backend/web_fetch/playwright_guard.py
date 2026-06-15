"""Process-wide lock for Playwright driver startup (sync API is not thread-safe)."""

from __future__ import annotations

import threading

guard = threading.Lock()
