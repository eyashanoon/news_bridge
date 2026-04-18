"""Test Arabic phrase search."""
from scraper import search_channels, _web_search_candidates
import requests

# Test 1: The exact query the user tried
query = "أحوال الطرق و حواجز الإحتلال"
print(f"=== Query: {query} ===")

# Check web search candidates
print("Web search candidates:")
candidates = _web_search_candidates(query, timeout=20)
print(f"  Found: {candidates}")

# Full search
results = search_channels(query, timeout=20)
print(f"Full search results: {len(results)}")
for r in results:
    print(f"  @{r['username']}: {r['title']}")

# Test 2: Try shorter Arabic keywords
for q in ["حواجز الاحتلال", "أحوال الطرق", "طرق فلسطين"]:
    print(f"\n=== Query: {q} ===")
    candidates = _web_search_candidates(q, timeout=20)
    print(f"  Candidates: {candidates[:10]}")
    results = search_channels(q, timeout=20)
    print(f"  Results: {len(results)}")
    for r in results:
        print(f"    @{r['username']}: {r['title']}")

# Test 3: Check if Startpage handles URL-encoded Arabic
import urllib.parse
encoded = urllib.parse.quote(query)
print(f"\n=== Encoded query: {encoded[:60]}... ===")
resp = requests.post(
    "https://www.startpage.com/do/search",
    data={"query": f"site:t.me {query}", "cat": "web"},
    headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
    },
    timeout=20,
)
print(f"  Status: {resp.status_code}, Length: {len(resp.text)}")
import re
tme = re.findall(r't\.me/([a-zA-Z_]\w{3,31})', resp.text)
print(f"  t.me usernames: {list(dict.fromkeys(tme))[:15]}")
