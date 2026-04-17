from __future__ import annotations

from math import expm1
from pathlib import Path
import pickle

from .extractor import extract_features, is_non_article_by_rule


_MODEL_PATH = Path(__file__).with_name("model.pkl")

with _MODEL_PATH.open("rb") as handle:
    _MODEL = pickle.load(handle)


def is_article(url: str, verbose: bool = False) -> bool:
    if is_non_article_by_rule(url):
        if verbose:
            print(f"  [RULE REJECT] {url}")
        return False

    features = extract_features(url)
    if not features:
        if verbose:
            print(f"  [FETCH FAIL] {url}")
        return False

    word_count_est = expm1(features[0])
    if word_count_est < 150:
        if verbose:
            print(f"  [WORD COUNT {int(word_count_est)}] too short, rejected")
        return False

    prediction = _MODEL.predict([features])[0]
    if verbose:
        prob = _MODEL.predict_proba([features])[0]
        print(f"  Confidence: article={prob[1]:.1%}  not-article={prob[0]:.1%}")

    return prediction == 1
