"""
predict.py — Classify whether a URL is a news article.
Loads model.pkl and runs inference on URLs from a JSON file.
"""

import pickle
import json
from math import expm1
from extractor import extract_features, is_non_article_by_rule

with open("model.pkl", "rb") as f:
    model = pickle.load(f)

FEATURE_NAMES = [
    "word_count_log",
    "p_count",
    "avg_p_length",
    "a_count",
    "link_density",
    "has_article_tag",
    "text_density",
    "url_length_log",
    "title_length",
    "has_date",
    "list_indicator",
    "metadata_richness",
    "img_density",
    "h1_count",
    "content_code_ratio",
    "social_share_count",
    "has_og_article",
    "has_twitter_card",
    "has_jsonld",
    "has_jsonld_article",
    "heading_density",
    "sentence_density",
]

CONFIRMED_ARTICLES_FILE = "confirmed_articles.json"


def is_article(url: str, verbose: bool = False) -> bool:
    """
    Returns True if the URL is a news/editorial article.

    Args:
        url:     The URL to classify.
        verbose: Print features and model confidence.
    """
    if is_non_article_by_rule(url):
        if verbose:
            print(f"  [RULE REJECT] {url}")
        return False

    features = extract_features(url)
    if not features:
        if verbose:
            print(f"  [FETCH FAIL] {url}")
        return False

    # Keep the hard minimum only at decision-time, not extraction-time.
    word_count_est = expm1(features[0])
    if word_count_est < 150:
        if verbose:
            print(f"  [WORD COUNT {int(word_count_est)}] too short, rejected")
        return False

    prob = model.predict_proba([features])[0]
    prediction = model.predict([features])[0]

    if verbose:
        print(f"  Confidence: article={prob[1]:.1%}  not-article={prob[0]:.1%}")
        for name, val in zip(FEATURE_NAMES, features):
            print(f"    {name:25s}: {round(val, 2)}")

    return prediction == 1


if __name__ == "__main__":
    # Load test URLs from JSON file
    try:
        with open("validated_seeds_labeled_1.json", "r", encoding="utf-8-sig") as f:
            tests = [(item["url"], bool(item["label"])) for item in json.load(f)]
        print(f"✅ Loaded {len(tests)} test URLs from validated_seeds_labeled_1.json")
    except FileNotFoundError:
        print("❌ Error: validated_seeds_labeled_1.json not found")
        exit(1)
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing JSON: {e}")
        exit(1)

    print("── Article Detection ────────────────────────────────────────────")
    ok = 0
    articles_correct = 0
    listings_correct = 0
    confirmed_articles = []
    articles_total = sum(1 for _, label in tests if label)
    listings_total = sum(1 for _, label in tests if not label)
    
    for url, expected in tests:
        result = is_article(url, verbose=False)  # Set to True for detailed feature output
        match = "✅" if result == expected else "❌"
        print(f"  {match}  {'Article' if result else 'Listing':<10}  (expected: {'Article' if expected else 'Listing':<10})  {url}")
        
        if result == expected:
            ok += 1
            if expected:
                articles_correct += 1
                # True positive: expected article and predicted article.
                confirmed_articles.append({"url": url, "label": 1})
            else:
                listings_correct += 1

    # Deduplicate while preserving order.
    seen_urls = set()
    unique_confirmed_articles = []
    for item in confirmed_articles:
        if item["url"] not in seen_urls:
            unique_confirmed_articles.append(item)
            seen_urls.add(item["url"])

    with open(CONFIRMED_ARTICLES_FILE, "w", encoding="utf-8") as f:
        json.dump(unique_confirmed_articles, f, indent=2)

    print(f"\n── Summary ────────────────────────────────────────────────────────")
    print(f"Total Correct: {ok}/{len(tests)} ({100*ok//len(tests)}%)")
    print(f"  Articles:    {articles_correct}/{articles_total}")
    print(f"  Listings:    {listings_correct}/{listings_total}")
    print(f"Confirmed articles saved: {len(unique_confirmed_articles)} -> {CONFIRMED_ARTICLES_FILE}")
