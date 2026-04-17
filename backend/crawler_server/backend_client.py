from __future__ import annotations

from typing import Any
import requests


class BackendClient:
    def __init__(self, base_url: str, email: str, password: str, timeout_seconds: int = 30) -> None:
        self.base_url = base_url.rstrip("/")
        self.email = email
        self.password = password
        self.timeout_seconds = timeout_seconds
        self.session = requests.Session()
        self._token: str | None = None

    def login(self) -> None:
        response = self.session.post(
            f"{self.base_url}/auth/admin/login",
            json={"email": self.email, "password": self.password},
            timeout=self.timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
        self._token = payload["token"]
        self.session.headers.update({"Authorization": f"Bearer {self._token}"})

    def _retry_on_unauthorized(self, method: str, path: str, **kwargs: Any) -> requests.Response:
        if self._token is None:
            self.login()

        response = self.session.request(method, f"{self.base_url}{path}", timeout=self.timeout_seconds, **kwargs)
        if response.status_code == 401:
            self.login()
            response = self.session.request(method, f"{self.base_url}{path}", timeout=self.timeout_seconds, **kwargs)
        return response

    def get_roots(self) -> list[dict[str, Any]]:
        response = self._retry_on_unauthorized("GET", "/roots")
        response.raise_for_status()
        return response.json()

    def get_endpoints(self, root_id: int) -> list[dict[str, Any]]:
        response = self._retry_on_unauthorized("GET", "/endpoints", params={"rootId": root_id})
        response.raise_for_status()
        return response.json()

    def create_endpoint(self, url: str, root_id: int) -> tuple[dict[str, Any] | None, bool]:
        response = self._retry_on_unauthorized(
            "POST",
            "/endpoints",
            json={"url": url, "rootId": root_id},
        )
        if response.status_code == 409:
            return None, False
        response.raise_for_status()
        return response.json(), True

    def find_endpoint_by_url(self, root_id: int, url: str) -> dict[str, Any] | None:
        for endpoint in self.get_endpoints(root_id):
            if endpoint.get("url") == url:
                return endpoint
        return None

    def get_cache_endpoint_by_url(self, source_endpoint_id: int, url: str) -> dict[str, Any] | None:
        response = self._retry_on_unauthorized(
            "GET",
            "/cache-endpoints",
            params={"sourceEndpointId": source_endpoint_id, "url": url},
        )
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return response.json()

    def create_article_record(self, payload: dict[str, Any]) -> dict[str, Any]:
        response = self._retry_on_unauthorized("POST", "/articles", json=payload)
        if response.status_code == 409:
            return response.json()
        response.raise_for_status()
        return response.json()

    def create_cache_endpoint(
        self,
        url: str,
        result: str,
        source_endpoint_id: int,
        extracted_text: str = "",
        dom_pattern: str = "",
        extracted_title: str = "",
        extracted_content_json: str = "",
    ) -> dict[str, Any] | None:
        payload: dict[str, Any] = {
            "url": url,
            "result": result,
            "sourceEndpointId": source_endpoint_id,
            "extractedText": extracted_text,
            "domPattern": dom_pattern,
            "extractedTitle": extracted_title,
            "extractedContentJson": extracted_content_json,
        }
        response = self._retry_on_unauthorized("POST", "/cache-endpoints", json=payload)
        if response.status_code == 409:
            return None
        response.raise_for_status()
        return response.json()
