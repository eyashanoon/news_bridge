import re
from typing import Dict, List, Tuple


TOKEN_RE = re.compile(r"[A-Za-z0-9_]+")


def tokenize(text: str) -> List[str]:
    """DEPRECATED: Use only numeric structural features instead for language-agnostic model."""
    return TOKEN_RE.findall((text or "").lower())


def pick_text(block: Dict) -> str:
    text = (block.get("text") or {}).get("clean")
    if text:
        return text
    content = block.get("content")
    if isinstance(content, str):
        return content
    return ""


def get_tag(block: Dict) -> str:
    structure = block.get("structure") or {}
    tag = (structure.get("tag") or "").lower()
    if tag:
        return tag
    return ((block.get("tag") or "").lower() or "unk")


def class_counts(block: Dict) -> Tuple[int, int]:
    attrs = block.get("attributes") or {}
    class_count = len(attrs.get("classList") or [])
    parent_class_count = len(attrs.get("parentClassList") or [])
    return class_count, parent_class_count


def _score_class_patterns(attrs: Dict) -> float:
    """Score how likely this element is article content based on class patterns."""
    class_list = attrs.get("classList") or []
    id_text = attrs.get("id") or ""
    parent_classes = attrs.get("parentClassList") or []
    
    article_hints = {"article", "content", "post", "story", "news", "main", "body", "entry"}
    noise_hints = {"nav", "footer", "header", "sidebar", "ad", "widget", "related", "share", "social"}
    
    class_text = f"{id_text} {' '.join(class_list)} {' '.join(parent_classes)}".lower()
    
    article_score = sum(1.0 for hint in article_hints if hint in class_text)
    noise_score = sum(1.0 for hint in noise_hints if hint in class_text)
    
    return (article_score - noise_score) / 10.0


def numeric_features(block: Dict) -> List[float]:
    """Extract STRUCTURAL features only (language-agnostic, not text-dependent)."""
    structure = block.get("structure") or {}
    position = block.get("position") or {}
    visual = position.get("visual") or {}
    text = block.get("text") or {}
    attrs = block.get("attributes") or {}
    media = block.get("media") or {}

    class_count, parent_class_count = class_counts(block)
    
    tag = structure.get("tag", "").lower()
    parent_tag = structure.get("parentTag", "").lower()

    def f(x, default=0.0):
        try:
            if x is None:
                return float(default)
            return float(x)
        except (TypeError, ValueError):
            return float(default)

    # Structural feature indicators
    is_heading = 1.0 if tag in {"h1", "h2", "h3", "h4", "h5", "h6"} else 0.0
    is_list_item = 1.0 if tag in {"li", "ul", "ol"} else 0.0
    is_paragraph = 1.0 if tag in {"p", "blockquote", "div"} else 0.0
    is_image = 1.0 if tag == "img" else 0.0
    is_figure = 1.0 if tag == "figure" else 0.0
    is_semantic_content = 1.0 if tag in {"article", "section", "main"} else 0.0
    is_link = 1.0 if tag == "a" or parent_tag == "a" else 0.0
    is_table = 1.0 if tag in {"table", "thead", "tbody", "tfoot", "tr", "td", "th"} else 0.0
    is_caption = 1.0 if tag in {"figcaption", "caption"} or parent_tag == "figure" else 0.0
    
    return [
        # High-priority structural features
        is_heading,
        is_paragraph,
        is_list_item,
        is_image,
        is_figure,
        is_semantic_content,
        
        # DOM position & hierarchy
        f(structure.get("depth")),
        f(structure.get("siblingIndex")),
        f(structure.get("siblingCount")),
        f(structure.get("sectionIndex")),
        f(position.get("domOrder")),
        f(position.get("relativePosition")),
        
        # Visual position (structural)
        f(visual.get("normalizedY")),
        f(visual.get("normalizedHeight")),

        # Structure-only signals that help separate content from layout noise
        is_link,
        is_table,
        is_caption,
        
        # Attributes and role indicators
        f(class_count),
        f(parent_class_count),
        1.0 if (attrs.get("id") or "") else 0.0,
        1.0 if (attrs.get("role") or "") else 0.0,
        _score_class_patterns(attrs),
        
        # Media presence
        1.0 if (media.get("src") or "") else 0.0,
    ]


def label_from_block(block: Dict) -> str:
    block_type = (block.get("type") or "").lower()
    if block_type == "text":
        return "TEXT"
    if block_type == "image":
        return "IMAGE"
    if block_type == "video":
        return "VIDEO"
    return "OTHER"
