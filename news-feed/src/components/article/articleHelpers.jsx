import React from "react";

const MEDIA_TYPES = new Set(["IMAGE", "VIDEO", "AUDIO", "ATTACHMENT", "OTHER"]);

export function isMediaBlock(block) {
  return MEDIA_TYPES.has(block.blockType) && !!block.mediaUrl;
}

export function renderInlineBlock(block) {
  if (block.blockType === "TEXT") return <p>{block.textContent}</p>;
  if (block.blockType === "IMAGE" && block.mediaUrl) return <img src={block.mediaUrl} className="post-image" alt={block.altText || ""} />;
  if (block.blockType === "VIDEO" && block.mediaUrl) return <video src={block.mediaUrl} controls className="post-video" />;
  if (block.blockType === "AUDIO" && block.mediaUrl) return <audio src={block.mediaUrl} controls className="post-audio" />;
  return null;
}

export function renderMediaStage(block) {
  if (!block) return <div className="media-empty">Scroll text to activate media</div>;
  if (block.blockType === "IMAGE") return <img src={block.mediaUrl} className="media-stage-img" alt={block.altText || ""} />;
  if (block.blockType === "VIDEO") return <video src={block.mediaUrl} controls className="media-stage-video" />;
  if (block.blockType === "AUDIO") return <audio src={block.mediaUrl} controls className="media-stage-audio" />;
  return <a href={block.mediaUrl} target="_blank" rel="noreferrer" className="media-file-link">Open media file</a>;
}

export function getCarouselWindow(items, start, limit) {
  if (items.length <= limit) return items;
  const out = [];
  for (let i = 0; i < limit; i += 1) out.push(items[(start + i) % items.length]);
  return out;
}