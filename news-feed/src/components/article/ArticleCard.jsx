import { renderInlineBlock } from "./articleHelpers";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function formatPublishedAt(value) {
  if (!value) return "";

  const publishedAt = new Date(value);
  if (Number.isNaN(publishedAt.getTime())) return "";

  const now = Date.now();
  const diffMs = now - publishedAt.getTime();

  if (diffMs < 0) return "Just now";

  if (diffMs > ONE_WEEK_MS) {
    return publishedAt.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ArticleCard({ article, onExpand }) {
  const blocks = article.blocks || [];
  const previewBlocks = blocks.slice(0, 3);
  const publishedLabel = formatPublishedAt(article.createdAt);
  const articleLink = article.articleUrl || article.url;

  return (
    <article className="post-card post-card-collapsed">
      <div className="frame-corners" />
      <div className="post-meta">
        <span className="root-chip">{article.rootName || "Unknown Root"}</span>
        {publishedLabel ? <span className="post-time">{publishedLabel}</span> : null}
      </div>
      <h2 className="post-title">{article.title || "Untitled"}</h2>
      <div className="post-content collapsed-content">
        {previewBlocks.map((block) => (
          <div key={block.id} className="block collapsed-block">{renderInlineBlock(block)}</div>
        ))}
      </div>
      <div className="card-actions">
        {articleLink ? (
          <a href={articleLink} target="_blank" rel="noreferrer" className="visit-btn">Visit Actual Article</a>
        ) : <span />}
        <button type="button" className="toggle-btn" onClick={onExpand}>Expand</button>
      </div>
    </article>
  );
}