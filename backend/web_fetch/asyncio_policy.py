"""
Windows asyncio policy for Playwright.

Uvicorn/FastAPI on Windows defaults to SelectorEventLoop, which cannot spawn
the Playwright driver subprocess. Playwright's sync API creates a fresh event
loop in worker threads and raises NotImplementedError without ProactorEventLoop.
"""

from __future__ import annotations

import asyncio
import sys

_applied = False


def apply_windows_proactor_policy() -> None:
    global _applied
    if _applied or not sys.platform.startswith("win"):
        return
    policy = asyncio.get_event_loop_policy()
    if isinstance(policy, asyncio.WindowsProactorEventLoopPolicy):
        _applied = True
        return
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    _applied = True


apply_windows_proactor_policy()
