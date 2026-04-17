from dataclasses import dataclass
from typing import Dict, List

import joblib
from sklearn.feature_extraction import DictVectorizer
from sklearn.linear_model import LogisticRegression


@dataclass
class ArticleModel:
    vectorizer: DictVectorizer
    classifier: LogisticRegression
    labels: List[str]

    def predict(self, feature_rows: List[Dict]):
        x = self.vectorizer.transform(feature_rows)
        probs = self.classifier.predict_proba(x)
        preds = self.classifier.classes_[probs.argmax(axis=1)]
        scores = probs.max(axis=1)
        return preds.tolist(), scores.tolist(), probs


def train_model(feature_rows: List[Dict], labels: List[str]) -> ArticleModel:
    vectorizer = DictVectorizer(sparse=True)
    x = vectorizer.fit_transform(feature_rows)

    clf = LogisticRegression(
        max_iter=2000,
        class_weight="balanced",
        multi_class="auto",
        n_jobs=None,
    )
    clf.fit(x, labels)

    return ArticleModel(vectorizer=vectorizer, classifier=clf, labels=sorted(set(labels)))


def save_model(model: ArticleModel, output_path: str) -> None:
    payload = {
        "vectorizer": model.vectorizer,
        "classifier": model.classifier,
        "labels": model.labels,
    }
    joblib.dump(payload, output_path)


def load_model(model_path: str) -> ArticleModel:
    payload = joblib.load(model_path)
    return ArticleModel(
        vectorizer=payload["vectorizer"],
        classifier=payload["classifier"],
        labels=payload.get("labels", []),
    )
