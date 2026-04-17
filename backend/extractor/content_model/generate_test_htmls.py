import argparse
import json
from pathlib import Path

import requests

from extract_dl import extract


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_MODEL_PATH = SCRIPT_DIR / "dl_article_model_url_supervised.pt"


def _build_blocks(content_items: list[dict]) -> list[dict]:
    blocks: list[dict] = []
    for index, item in enumerate(content_items, start=1):
        raw_type = str(item.get("type") or "text").strip().upper()
        if raw_type not in {"TEXT", "IMAGE", "VIDEO", "AUDIO", "ATTACHMENT", "OTHER"}:
            raw_type = "OTHER"
        blocks.append(
            {
                "sortOrder": int(item.get("order") or index),
                "blockType": raw_type,
                "textContent": str(item.get("text") or item.get("content") or "") if raw_type == "TEXT" else "",
                "mediaUrl": str(item.get("src") or item.get("content") or "") if raw_type != "TEXT" else "",
                "altText": str(item.get("alt") or ""),
                "score": float(item.get("score") or 0.0),
            }
        )
    return blocks


def _flatten_text(content_items: list[dict], fallback: str) -> str:
    parts = [
        str(item.get("text") or "").strip()
        for item in content_items
        if str(item.get("type") or "").lower() == "text" and str(item.get("text") or "").strip()
    ]
    joined = "\n\n".join(parts)
    return joined if joined else fallback


def _login(base_url: str, email: str, password: str, timeout_seconds: int) -> dict[str, str]:
    response = requests.post(
        f"{base_url.rstrip('/')}/auth/login",
        json={"email": email, "password": password},
        timeout=timeout_seconds,
    )
    response.raise_for_status()
    token = response.json()["token"]
    return {"Authorization": f"Bearer {token}"}


def _get_or_create_cache(
    base_url: str,
    headers: dict[str, str],
    source_endpoint_id: int,
    url: str,
    title: str,
    flattened_text: str,
    extracted: dict,
    timeout_seconds: int,
) -> dict:
    payload = {
        "url": url,
        "result": "ARTICLE",
        "sourceEndpointId": source_endpoint_id,
        "extractedText": flattened_text[:20000],
        "extractedTitle": title[:2000],
        "extractedContentJson": json.dumps(extracted, ensure_ascii=False)[:50000],
        "domPattern": "",
    }
    create_response = requests.post(
        f"{base_url.rstrip('/')}/cache-endpoints",
        headers=headers,
        json=payload,
        timeout=timeout_seconds,
    )
    if create_response.status_code == 409:
        existing = requests.get(
            f"{base_url.rstrip('/')}/cache-endpoints",
            headers=headers,
            params={"sourceEndpointId": source_endpoint_id, "url": url},
            timeout=timeout_seconds,
        )
        existing.raise_for_status()
        return existing.json()

    create_response.raise_for_status()
    return create_response.json()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract a single article URL using deep_learning2 logic and store the result in the backend database."
    )
    parser.add_argument("--url", required=True, help="Single article URL to extract")
    parser.add_argument("--source-endpoint-id", required=True, type=int, help="Source endpoint id for cache_endpoints")
    parser.add_argument("--endpoint-id", type=int, default=0, help="Endpoint id for articles (defaults to source-endpoint-id)")
    parser.add_argument("--model", default=str(DEFAULT_MODEL_PATH), help="Path to trained model file")
    parser.add_argument("--threshold-text", type=float, default=0.62)
    parser.add_argument("--threshold-media", type=float, default=0.75)
    parser.add_argument("--threshold-title", type=float, default=0.30)
    parser.add_argument("--backend-base-url", default="http://localhost:8080")
    parser.add_argument("--backend-email", default="crawler-service@news.local")
    parser.add_argument("--backend-password", default="secure-crawler-password-change-me")
    parser.add_argument("--timeout", type=int, default=30)
    args = parser.parse_args()

    model_path = Path(args.model)
    if not model_path.exists():
        raise SystemExit(f"Missing model file: {model_path}")

    print(f"Extracting URL: {args.url}")
    extracted = extract(
        url=args.url,
        model_path=str(model_path),
        text_thr=args.threshold_text,
        media_thr=args.threshold_media,
        title_thr=args.threshold_title,
    )

    content_items = extracted.get("content", []) or []
    title = (extracted.get("title") or "").strip() or args.url
    flattened_text = _flatten_text(content_items, title)
    blocks = _build_blocks(content_items)

    endpoint_id = int(args.endpoint_id or args.source_endpoint_id)
    headers = _login(args.backend_base_url, args.backend_email, args.backend_password, args.timeout)

    cache_endpoint = _get_or_create_cache(
        base_url=args.backend_base_url,
        headers=headers,
        source_endpoint_id=args.source_endpoint_id,
        url=args.url,
        title=title,
        flattened_text=flattened_text,
        extracted=extracted,
        timeout_seconds=args.timeout,
    )

    article_payload = {
        "url": args.url,
        "title": title,
        "text": flattened_text[:50000],
        "endpointId": endpoint_id,
        "cacheEndpointId": int(cache_endpoint["id"]),
        "blocks": blocks,
    }

    article_response = requests.post(
        f"{args.backend_base_url.rstrip('/')}/articles",
        headers=headers,
        json=article_payload,
        timeout=args.timeout,
    )
    if article_response.status_code not in {200, 201, 409}:
        article_response.raise_for_status()

    print(
        json.dumps(
            {
                "status": "ok",
                "url": args.url,
                "title": title,
                "blocksCount": len(blocks),
                "cacheEndpointId": int(cache_endpoint["id"]),
                "articleResultStatus": article_response.status_code,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
