from pathlib import Path

from .extract_dl import extract


_MODEL_PATH = Path(__file__).with_name("dl_article_model_url_supervised.pt")


def extract_article(url: str, text_thr: float = 0.62, media_thr: float = 0.75, title_thr: float = 0.30):
    return extract(
        url=url,
        model_path=str(_MODEL_PATH),
        text_thr=text_thr,
        media_thr=media_thr,
        title_thr=title_thr,
    )
