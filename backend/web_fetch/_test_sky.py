"""Smoke test for the shared web_fetch layer."""

from web_fetch import fetch_html

URL = "https://news.sky.com/"


def main() -> None:
    result = fetch_html(URL, profile="discovery", timeout=45, allow_browser=True)
    print(f"method={result.method} status={result.status_code} len={len(result.html)}")
    print(f"ok={result.ok} error={result.error}")
    print(f"links={result.html.lower().count('<a ') if result.html else 0}")


if __name__ == "__main__":
    main()
