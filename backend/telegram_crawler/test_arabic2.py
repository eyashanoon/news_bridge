"""Test broader search strategies for Arabic/non-Latin queries."""
import re
import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
}

SKIP = frozenset({
    "s", "proxy", "socks", "addstickers", "joinchat", "addtheme",
    "share", "login", "setlanguage", "addlist", "boost", "iv", "a",
    "dl", "confirmphone", "passport", "bg",
})

query = "أحوال الطرق و حواجز الإحتلال"


def extract_tme(text):
    found = []
    for m in re.finditer(r't\.me/([a-zA-Z_]\w{3,31})', text):
        u = m.group(1)
        if u.lower() not in SKIP:
            found.append(u)
    return list(dict.fromkeys(found))


# Strategy 1: Startpage without site:t.me, add "telegram" keyword
print("=== Strategy 1: Startpage + 'telegram channel' keyword ===")
resp = requests.post(
    "https://www.startpage.com/do/search",
    data={"query": f'telegram channel "{query}"', "cat": "web"},
    headers=HEADERS, timeout=20,
)
print(f"  Status: {resp.status_code}, Length: {len(resp.text)}")
usernames = extract_tme(resp.text)
print(f"  t.me usernames: {usernames[:15]}")

# Strategy 2: Startpage with "t.me" in query but not site: restriction
print("\n=== Strategy 2: Startpage 't.me + query' ===")
resp = requests.post(
    "https://www.startpage.com/do/search",
    data={"query": f't.me {query}', "cat": "web"},
    headers=HEADERS, timeout=20,
)
print(f"  Status: {resp.status_code}, Length: {len(resp.text)}")
usernames = extract_tme(resp.text)
print(f"  t.me usernames: {usernames[:15]}")

# Strategy 3: Startpage with "telegram" + query (no site restriction)
print("\n=== Strategy 3: Startpage 'telegram + query' ===")
resp = requests.post(
    "https://www.startpage.com/do/search",
    data={"query": f'telegram {query}', "cat": "web"},
    headers=HEADERS, timeout=20,
)
print(f"  Status: {resp.status_code}, Length: {len(resp.text)}")
usernames = extract_tme(resp.text)
print(f"  t.me usernames: {usernames[:15]}")

# Strategy 4: Bing with t.me + query
print("\n=== Strategy 4: Bing 't.me + query' ===")
resp = requests.get(
    "https://www.bing.com/search",
    params={"q": f"t.me {query}", "count": 30},
    headers=HEADERS, timeout=20,
)
print(f"  Status: {resp.status_code}, Length: {len(resp.text)}")
soup = BeautifulSoup(resp.text, "html.parser")
# Check cite elements
for cite in soup.find_all("cite"):
    text = cite.get_text(strip=True)
    if "t.me" in text:
        print(f"  Cite: {text}")
usernames = extract_tme(resp.text)
print(f"  t.me usernames: {usernames[:15]}")

# Strategy 5: Bing with "telegram channel" + query
print("\n=== Strategy 5: Bing 'telegram channel + query' ===")
resp = requests.get(
    "https://www.bing.com/search",
    params={"q": f"telegram channel {query}", "count": 30},
    headers=HEADERS, timeout=20,
)
print(f"  Status: {resp.status_code}, Length: {len(resp.text)}")
usernames = extract_tme(resp.text)
print(f"  t.me usernames: {usernames[:15]}")

# also scan for hrefs with t.me
soup = BeautifulSoup(resp.text, "html.parser")
for a in soup.find_all("a", href=True):
    href = a["href"]
    if "t.me/" in href and "microsoft" not in href:
        text = a.get_text(strip=True)[:80]
        print(f"  Link: {href[:100]} | {text}")

# Strategy 6: Google with "telegram" + query
print("\n=== Strategy 6: Google 'telegram channel + query' ===")
resp = requests.get(
    "https://www.google.com/search",
    params={"q": f"telegram channel {query}", "num": 20, "hl": "ar"},
    headers=HEADERS, timeout=20,
)
print(f"  Status: {resp.status_code}, Length: {len(resp.text)}")
usernames = extract_tme(resp.text)
print(f"  t.me usernames: {usernames[:15]}")

# Strategy 7: Try shorter keywords from the query
print("\n=== Strategy 7: Startpage with site:t.me + shorter keyword ===")
# Use the most distinctive word(s)
for kw in ["أحوال الطرق", "حواجز", "حواجز الاحتلال"]:
    resp = requests.post(
        "https://www.startpage.com/do/search",
        data={"query": f"site:t.me {kw}", "cat": "web"},
        headers=HEADERS, timeout=20,
    )
    usernames = extract_tme(resp.text)
    print(f"  '{kw}': {usernames[:10]}")
