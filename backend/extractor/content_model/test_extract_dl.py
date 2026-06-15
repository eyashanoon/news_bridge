import unittest

from extract_dl import (
    _effective_image_threshold,
    _is_below_min_article_image_size,
    _is_in_image_link_grid,
    _is_recommendation_container,
    _is_recommendation_media,
    _is_recommendation_video,
    _is_short_video_url,
    _is_thumbnail_url,
    _prune_noise_subtrees,
    _should_keep_article_image,
    _should_keep_article_video,
    extract,
    fetch_blocks,
)
from bs4 import BeautifulSoup
from pathlib import Path


MODEL_PATH = Path(__file__).with_name("dl_article_model_url_supervised.pt")


def _article_html_with_recommendations() -> str:
    paragraphs = " ".join(
        f"<p>Article body paragraph {i} with enough words to qualify as real article content for extraction testing.</p>"
        for i in range(1, 9)
    )
    return f"""
    <html><head><title>Sample Article Title For Testing Extraction</title></head>
    <body>
      <main>
        <article class="story-body">
          <h1>Sample Article Title For Testing Extraction</h1>
          <figure>
            <img src="https://cdn.example.com/news/hero-main-photo.jpg" alt="Main hero image for the sample article about testing extraction quality" width="1200" height="800" />
          </figure>
          {paragraphs}
          <figure>
            <img src="https://cdn.example.com/news/inline-body-photo.jpg" alt="Inline body image showing the event described in the article" width="900" height="600" />
          </figure>
        </article>
        <section class="related-stories">
          <h2>Related Stories</h2>
          <ul>
            <li><a href="/story-1"><img src="https://cdn.example.com/thumbs/story-1-thumb.jpg" alt="Other story" width="80" height="80" /></a></li>
            <li><a href="/story-2"><img src="https://cdn.example.com/thumbs/story-2-thumb.jpg" alt="Another story" width="80" height="80" /></a></li>
            <li><a href="/story-3"><img src="https://cdn.example.com/thumbs/story-3-thumb.jpg" alt="Third story" width="80" height="80" /></a></li>
          </ul>
        </section>
        <aside class="recommended">
          <div class="story-card"><a href="/rec-1"><img src="https://cdn.example.com/cards/rec-1.jpg" width="100" height="100" alt="Recommended" /></a></div>
          <div class="story-card"><a href="/rec-2"><img src="https://cdn.example.com/cards/rec-2.jpg" width="100" height="100" alt="Recommended" /></a></div>
          <div class="story-card"><a href="/rec-3"><img src="https://cdn.example.com/cards/rec-3.jpg" width="100" height="100" alt="Recommended" /></a></div>
        </aside>
      </main>
    </body></html>
    """


class ExtractDlHeuristicTests(unittest.TestCase):
    def test_thumbnail_url_detection(self):
        self.assertTrue(_is_thumbnail_url("https://cdn.example.com/thumbs/story-1-thumb.jpg"))
        self.assertFalse(_is_thumbnail_url("https://cdn.example.com/news/hero-main-photo.jpg"))

    def test_recommendation_container_detection(self):
        soup = BeautifulSoup('<div class="related-stories"></div>', "lxml")
        self.assertTrue(_is_recommendation_container(soup.div))

    def test_prune_removes_related_section(self):
        soup = BeautifulSoup(_article_html_with_recommendations(), "lxml")
        root = soup.find("main")
        _prune_noise_subtrees(root)
        self.assertIsNone(root.find(class_="related-stories"))
        self.assertIsNone(root.find("aside"))

    def test_image_link_grid_detection(self):
        soup = BeautifulSoup(
            '<div><a><img src="a.jpg"/></a><a><img src="b.jpg"/></a><a><img src="c.jpg"/></a></div>',
            "lxml",
        )
        img = soup.find("img")
        self.assertTrue(_is_in_image_link_grid(img))

    def test_recommendation_media_block(self):
        block = {
            "structure": {"tag": "img", "parentTag": "a", "siblingImgCount": 3},
            "attributes": {
                "hasAnchorAncestor": True,
                "inImageLinkGrid": True,
                "containerLinkDensity": 0.8,
            },
            "media": {
                "src": "https://cdn.example.com/thumbs/story-1-thumb.jpg",
                "alt": "Other story",
                "width": "80",
                "height": "80",
            },
            "position": {"relativePosition": 0.7},
        }
        self.assertTrue(_is_recommendation_media(block, "IMAGE", text_kept=4))

    def test_effective_image_threshold_is_not_too_low(self):
        block = {
            "structure": {"tag": "img", "parentTag": "a"},
            "attributes": {"hasAnchorAncestor": True},
            "position": {"relativePosition": 0.6},
        }
        self.assertGreaterEqual(_effective_image_threshold(block, 0.75), 0.68)

    def test_effective_image_threshold_does_not_discount_linked_figures(self):
        block = {
            "structure": {"tag": "img", "parentTag": "figure"},
            "attributes": {"hasAnchorAncestor": True, "inImageLinkGrid": True},
            "position": {"relativePosition": 0.4},
        }
        self.assertGreaterEqual(_effective_image_threshold(block, 0.75), 0.72)

    def test_recommendation_media_flags_linked_sibling_pair(self):
        block = {
            "structure": {"tag": "img", "parentTag": "a", "siblingImgCount": 2},
            "attributes": {"hasAnchorAncestor": True, "inImageLinkGrid": False},
            "media": {
                "src": "https://cdn.example.com/promo/story-card.jpg",
                "alt": "Another headline",
                "width": "320",
                "height": "180",
            },
            "position": {"relativePosition": 0.45},
        }
        self.assertTrue(_is_recommendation_media(block, "IMAGE", text_kept=4))

    def test_should_keep_article_image_rejects_undimensioned_linked_thumb(self):
        block = {
            "structure": {"tag": "img", "parentTag": "a", "siblingImgCount": 1},
            "attributes": {"hasAnchorAncestor": True},
            "media": {
                "src": "https://cdn.example.com/promo/story-card.jpg",
                "alt": "Short",
            },
            "position": {"relativePosition": 0.4},
        }
        self.assertFalse(_should_keep_article_image(block, score=0.95, media_thr=0.75, text_kept=4))

    def test_below_min_article_image_size(self):
        block = {
            "media": {"src": "https://cdn.example.com/thumbs/story-1-thumb.jpg", "width": "150", "height": "150"},
        }
        self.assertTrue(_is_below_min_article_image_size(block))
        hero = {
            "media": {"src": "https://cdn.example.com/news/hero-main-photo.jpg", "width": "900", "height": "600"},
        }
        self.assertFalse(_is_below_min_article_image_size(hero))

    def test_short_video_url_detection(self):
        self.assertTrue(_is_short_video_url("https://www.youtube.com/shorts/abc123"))
        self.assertTrue(_is_short_video_url("https://www.tiktok.com/@user/video/123"))
        self.assertFalse(_is_short_video_url("https://www.youtube.com/embed/dQw4w9WgXcQ"))

    def test_should_keep_article_image_rejects_small_linked_thumb(self):
        block = {
            "structure": {"tag": "img", "parentTag": "a", "siblingImgCount": 3},
            "attributes": {
                "hasAnchorAncestor": True,
                "inImageLinkGrid": True,
                "containerLinkDensity": 0.8,
            },
            "media": {
                "src": "https://cdn.example.com/thumbs/story-1-thumb.jpg",
                "alt": "Other story",
                "width": "80",
                "height": "80",
            },
            "position": {"relativePosition": 0.7},
        }
        self.assertFalse(_should_keep_article_image(block, score=0.95, media_thr=0.75, text_kept=4))

    def test_should_keep_article_video_rejects_shorts(self):
        block = {
            "structure": {"tag": "iframe", "parentTag": "div"},
            "attributes": {"classList": ["video-widget"], "parentClassList": []},
            "media": {"src": "https://www.youtube.com/shorts/abc123", "width": "320", "height": "180"},
            "position": {"relativePosition": 0.7},
        }
        self.assertFalse(_should_keep_article_video(block, score=0.95, media_thr=0.75, text_kept=4))

    def test_recommendation_video_in_sidebar(self):
        block = {
            "structure": {"tag": "iframe", "parentTag": "aside"},
            "attributes": {"classList": [], "parentClassList": ["recommended", "sidebar"]},
            "media": {"src": "https://www.youtube.com/embed/dQw4w9WgXcQ", "width": "560", "height": "315"},
            "position": {"relativePosition": 0.8},
        }
        self.assertTrue(_is_recommendation_video(block, text_kept=4))


class ExtractDlIntegrationTests(unittest.TestCase):
    @unittest.skipUnless(MODEL_PATH.exists(), "model weights missing")
    def test_excludes_recommendation_images(self):
        url = "https://example.com/news/sample-article-title-for-testing-extraction"
        html = _article_html_with_recommendations()
        result = extract(
            url=url,
            model_path=str(MODEL_PATH),
            text_thr=0.62,
            media_thr=0.75,
            title_thr=0.30,
            html=html,
        )
        image_srcs = [item["src"] for item in result.get("content", []) if item.get("type") == "image"]
        self.assertTrue(any("hero-main-photo" in src for src in image_srcs))
        self.assertFalse(any("thumb" in src for src in image_srcs))
        self.assertFalse(any("/cards/rec-" in src for src in image_srcs))

    @unittest.skipUnless(MODEL_PATH.exists(), "model weights missing")
    def test_fetch_blocks_skips_pruned_recommendations(self):
        url = "https://example.com/news/sample-article-title-for-testing-extraction"
        html = _article_html_with_recommendations()
        _, blocks = fetch_blocks(url, html=html)
        media_srcs = [(block.get("media") or {}).get("src", "") for block in blocks]
        self.assertFalse(any("story-1-thumb" in src for src in media_srcs))
        self.assertFalse(any("/cards/rec-" in src for src in media_srcs))


if __name__ == "__main__":
    unittest.main()
