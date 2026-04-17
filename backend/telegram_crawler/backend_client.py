from __future__ import annotations

from typing import Any
import requests


class BackendClient:
    """HTTP client that authenticates against the Spring Boot backend."""

    def __init__(self, base_url: str, email: str, password: str, timeout: int = 30) -> None:
        self.base_url = base_url.rstrip("/")
        self.email = email
        self.password = password
        self.timeout = timeout
        self.session = requests.Session()
        self._token: str | None = None

    def login(self) -> None:
        resp = self.session.post(
            f"{self.base_url}/auth/admin/login",
            json={"email": self.email, "password": self.password},
            timeout=self.timeout,
        )
        resp.raise_for_status()
        self._token = resp.json()["token"]
        self.session.headers.update({"Authorization": f"Bearer {self._token}"})

    def _request(self, method: str, path: str, **kwargs: Any) -> requests.Response:
        if self._token is None:
            self.login()
        resp = self.session.request(method, f"{self.base_url}{path}", timeout=self.timeout, **kwargs)
        if resp.status_code == 401:
            self.login()
            resp = self.session.request(method, f"{self.base_url}{path}", timeout=self.timeout, **kwargs)
        return resp

    # ── Telegram Channels ────────────────────────────────────────────────────

    def get_active_channels(self) -> list[dict[str, Any]]:
        resp = self._request("GET", "/api/telegram/channels/active")
        resp.raise_for_status()
        return resp.json()

    # ── Telegram Posts ───────────────────────────────────────────────────────

    def bulk_create_posts(self, posts: list[dict[str, Any]]) -> dict[str, Any]:
        resp = self._request("POST", "/api/telegram/posts/bulk", json={"posts": posts})
        resp.raise_for_status()
        return resp.json()
