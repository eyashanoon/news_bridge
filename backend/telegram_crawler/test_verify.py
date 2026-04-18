from scraper import _validate_channel
info = _validate_channel("ahwalaltreq", timeout=15)
if info:
    print(f"@{info['username']}: {info['title']}")
    print(f"  Subscribers: {info.get('subscribers')}")
    print(f"  Description: {info.get('description', '')[:100]}")
    print(f"  Preview: {info.get('hasPublicPreview')}")
else:
    print("Not a valid channel")
