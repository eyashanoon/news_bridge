import { useEffect, useMemo, useRef, useState } from "react";
import { getCarouselWindow, isMediaBlock, renderMediaStage } from "./articleHelpers";

const THUMB_LIMIT = 5;

export default function ArticleOverlay({ article, onClose }) {
  const textPaneRef = useRef(null);
  const stepRefs = useRef([]);
  const [autoMediaIndex, setAutoMediaIndex] = useState(-1);
  const [manualMediaIndex, setManualMediaIndex] = useState(null);
  const [previousMedia, setPreviousMedia] = useState(null);
  const [isMediaAnimating, setIsMediaAnimating] = useState(false);
  const [thumbStart, setThumbStart] = useState(0);
  const lastActiveMediaRef = useRef(null);

  const blocks = article.blocks || [];
  const mediaBlocks = useMemo(() => blocks.filter((block) => isMediaBlock(block)).map((block, idx) => ({ ...block, mediaIndex: idx })), [blocks]);
  const blockFlow = useMemo(() => blocks.map((block, index) => ({ ...block, orderIndex: index })), [blocks]);

  useEffect(() => {
    const onScroll = () => {
      const pane = textPaneRef.current;
      if (!pane) return;
      const threshold = pane.scrollTop + pane.clientHeight * 0.35;
      let currentFlowIndex = 0;

      stepRefs.current.forEach((node, index) => {
        if (node && node.offsetTop <= threshold) currentFlowIndex = index;
      });

      let nextMediaIndex = -1;
      blockFlow.forEach((block, index) => {
        if (index <= currentFlowIndex && isMediaBlock(block)) nextMediaIndex += 1;
      });

      setManualMediaIndex(null);
      setAutoMediaIndex(nextMediaIndex);
    };

    const pane = textPaneRef.current;
    if (!pane) return;
    onScroll();
    pane.addEventListener("scroll", onScroll);
    return () => pane.removeEventListener("scroll", onScroll);
  }, [blockFlow]);

  const displayMediaIndex = manualMediaIndex ?? autoMediaIndex;
  const effectiveMediaIndex = mediaBlocks.length === 0 ? -1 : Math.max(displayMediaIndex, 0);
  const displayMedia = effectiveMediaIndex >= 0 ? mediaBlocks[effectiveMediaIndex] : null;

  useEffect(() => {
    const current = displayMedia || null;
    const previous = lastActiveMediaRef.current;
    if (previous && current && previous.mediaUrl !== current.mediaUrl) {
      setPreviousMedia(previous);
      setIsMediaAnimating(true);
      const timeoutId = setTimeout(() => {
        setIsMediaAnimating(false);
        setPreviousMedia(null);
      }, 420);
      lastActiveMediaRef.current = current;
      return () => clearTimeout(timeoutId);
    }
    lastActiveMediaRef.current = current;
    return undefined;
  }, [displayMedia]);

  const thumbnailMedia = mediaBlocks.filter((_, idx) => idx !== effectiveMediaIndex);
  const visibleThumbs = getCarouselWindow(thumbnailMedia, thumbStart, THUMB_LIMIT);

  useEffect(() => setThumbStart(0), [effectiveMediaIndex, thumbnailMedia.length]);

  useEffect(() => {
    if (thumbnailMedia.length <= THUMB_LIMIT) return undefined;
    const intervalId = setInterval(() => {
      setThumbStart((prev) => (prev + 1) % thumbnailMedia.length);
    }, 2800);
    return () => clearInterval(intervalId);
  }, [thumbnailMedia.length]);

  return (
    <div className="overlay-backdrop" role="dialog" aria-modal="true">
      <article className="post-card post-card-expanded overlay-panel">
        <button type="button" className="overlay-close" onClick={onClose} aria-label="Close">x</button>
        <div className="frame-corners" />
        <div className="post-meta">
          <span className="root-chip">{article.rootName || "Unknown Root"}</span>
          {article.articleUrl && (
            <a href={article.articleUrl} target="_blank" rel="noreferrer" className="source-link">Go to original article</a>
          )}
        </div>

        <h2 className="post-title">{article.title || "Untitled"}</h2>

        <div className="expanded-grid">
          <div className="text-pane" ref={textPaneRef}>
            {blockFlow.map((block, index) => (
              <div
                key={block.id ?? `${block.blockType}-${index}`}
                className={block.blockType === "TEXT" ? "flow-step text-step" : "flow-step media-step"}
                ref={(node) => { stepRefs.current[index] = node; }}
              >
                {block.blockType === "TEXT" ? <p>{block.textContent}</p> : <div className="media-marker">Media checkpoint: {block.blockType.toLowerCase()}</div>}
              </div>
            ))}
          </div>

          <aside className="media-pane">
            <div className="media-stage">
              {isMediaAnimating && previousMedia && <div className="media-layer media-layer-old">{renderMediaStage(previousMedia)}</div>}
              <div className={`media-layer ${isMediaAnimating ? "media-layer-new" : ""}`}>{renderMediaStage(displayMedia)}</div>
            </div>

            <div className="media-carousel">
              <button
                type="button"
                className="carousel-arrow"
                onClick={() => setThumbStart((prev) => (prev - 1 + Math.max(thumbnailMedia.length, 1)) % Math.max(thumbnailMedia.length, 1))}
                disabled={thumbnailMedia.length <= 1}
              >&lt;</button>
              <div className="media-strip">
                {visibleThumbs.map((media, idx) => (
                  <button
                    type="button"
                    key={media.id ?? `${media.mediaUrl}-${idx}`}
                    className="media-thumb"
                    onClick={() => {
                      const selectedIndex = mediaBlocks.findIndex((item) => item.mediaUrl === media.mediaUrl);
                      if (selectedIndex >= 0) setManualMediaIndex(selectedIndex);
                    }}
                  >
                    {media.blockType === "IMAGE" ? <img src={media.mediaUrl} alt={media.altText || "preview"} /> : <span>{media.blockType.toLowerCase()}</span>}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="carousel-arrow"
                onClick={() => setThumbStart((prev) => (prev + 1) % Math.max(thumbnailMedia.length, 1))}
                disabled={thumbnailMedia.length <= 1}
              >&gt;</button>
            </div>
          </aside>
        </div>
      </article>
    </div>
  );
}
