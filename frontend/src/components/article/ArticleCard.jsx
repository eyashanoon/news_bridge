import { renderInlineBlock } from "./articleHelpers";

export default function ArticleCard({ article, onExpand }) {
  const blocks = article.blocks || [];
  const previewBlocks = blocks.slice(0, 3);

  return (
    <article className="post-card post-card-collapsed">
      <div className="frame-corners" />
      <div className="post-meta">
        <span className="root-chip">{article.rootName || "Unknown Root"}</span>
      </div>
      <h2 className="post-title">{article.title || "Untitled"}</h2>
      <div className="post-content collapsed-content">
        {previewBlocks.map((block) => (
          <div key={block.id} className="block collapsed-block">{renderInlineBlock(block)}</div>
        ))}
      </div>
      <div className="card-actions">
        {article.articleUrl ? (
          <a href={article.articleUrl} target="_blank" rel="noreferrer" className="visit-btn">Visit Actual Article</a>
        ) : <span />}
        <button type="button" className="toggle-btn" onClick={onExpand}>Expand</button>
      </div>
    </article>
  );
}
