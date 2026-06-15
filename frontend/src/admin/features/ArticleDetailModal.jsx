import { useState } from "react";

function blockConfidenceLabel(score) {
  if (score == null || Number.isNaN(Number(score))) {
    return { text: "N/A", tier: "unknown" };
  }
  const pct = Math.round(Number(score) * 100);
  let tier = "low";
  if (pct >= 80) tier = "high";
  else if (pct >= 60) tier = "medium";
  return { text: `${pct}%`, tier };
}

function ConfidenceBadge({ score }) {
  const { text, tier } = blockConfidenceLabel(score);
  return (
    <span
      className={`block-confidence-badge block-confidence-${tier}`}
      title="Model confidence that this block belongs to the article body"
    >
      Confidence: {text}
    </span>
  );
}

export function ArticleDetailModal({ article, loading, onClose, onDelete, onDeleteBlock, canUpdate, askConfirm }) {
  const [view, setView] = useState("view");
  const [selectedBlocks, setSelectedBlocks] = useState(new Set());
  const [modalError, setModalError] = useState("");

  const toggleBlockSelect = (blockId) => {
    const newSet = new Set(selectedBlocks);
    if (newSet.has(blockId)) {
      newSet.delete(blockId);
    } else {
      newSet.add(blockId);
    }
    setSelectedBlocks(newSet);
  };

  const handleDeleteSelected = async () => {
    if (selectedBlocks.size === 0) {
      setModalError("Select at least one block to delete.");
      return;
    }
    const ok = await askConfirm(`Delete ${selectedBlocks.size} block(s)?`);
    if (!ok) return;
    setModalError("");
    for (const blockId of selectedBlocks) {
      await onDeleteBlock(article.articleId, blockId);
    }
    setSelectedBlocks(new Set());
  };

  const renderBlock = (block) => {
    const type = block.blockType;
    const isSelected = selectedBlocks.has(block.id);
    const blockClass = `article-block ${isSelected ? "selected" : ""}`;

    if (view === "view") {
      let content = null;
      if (type === "IMAGE" && block.mediaUrl) {
        content = (
          <figure className="article-figure">
            <img src={block.mediaUrl} alt={block.altText || "Article image"} />
            {block.altText && <figcaption>{block.altText}</figcaption>}
          </figure>
        );
      } else if (type === "VIDEO" && block.mediaUrl) {
        content = (
          <div className="article-video-embed">
            <video controls src={block.mediaUrl} playsInline></video>
          </div>
        );
      } else if (["AUDIO", "ATTACHMENT"].includes(type) && block.mediaUrl) {
        content = (
          <div className="article-attachment">
            <a href={block.mediaUrl} target="_blank" rel="noopener noreferrer">{block.mediaUrl}</a>
          </div>
        );
      } else if (type === "TEXT" && block.textContent) {
        content = <p className="article-paragraph">{block.textContent}</p>;
      }
      if (!content) return null;
      return (
        <div key={block.id} className="article-block-wrapper">
          <div className="article-block-meta">
            <span className="article-block-type">{type}</span>
            <ConfidenceBadge score={block.score} />
          </div>
          {content}
        </div>
      );
    } else {
      // Edit mode
      return (
        <div key={block.id} className={blockClass} onClick={() => toggleBlockSelect(block.id)}>
          <div className="block-header">
            <span>{type} #{block.sortOrder}</span>
            <div className="block-header-badges">
              <ConfidenceBadge score={block.score} />
              {isSelected && <span className="selected-badge">Selected</span>}
            </div>
          </div>
          {type === "IMAGE" && block.mediaUrl && <img src={block.mediaUrl} alt={block.altText || "Article image"} />}
          {type === "VIDEO" && block.mediaUrl && <video controls src={block.mediaUrl} playsInline></video>}
          {["AUDIO", "ATTACHMENT"].includes(type) && block.mediaUrl && <a href={block.mediaUrl} target="_blank" rel="noopener noreferrer">{block.mediaUrl}</a>}
          {type === "TEXT" && <p>{block.textContent}</p>}
        </div>
      );
    }
  };

  return (
    <div className="article-modal-overlay" onClick={onClose}>
      <div className="article-modal" onClick={(e) => e.stopPropagation()}>
        <div className="article-modal-header">
          <div className="article-modal-tabs">
            <button className={`modal-tab ${view === "view" ? "active" : ""}`} onClick={() => setView("view")}>View Article</button>
            {canUpdate && <button className={`modal-tab ${view === "edit" ? "active" : ""}`} onClick={() => setView("edit")}>Edit Content</button>}
          </div>
          <button className="modal-close-btn" onClick={onClose}>x</button>
        </div>

        <div className="article-modal-content">
          {loading && <div className="loading">Loading...</div>}
          {!loading && (
            <>
              {modalError && <div className="admin-error">{modalError}</div>}
              <h2 className="article-modal-title">{article.title || "Untitled Article"}</h2>
              <p className="article-modal-meta">Root: {article.rootName || "-"} | Endpoint: {article.endpointUrl || "-"}</p>

              {view === "view" && (
                <div className="article-content">
                  {(article.blocks || []).sort((a, b) => a.sortOrder - b.sortOrder).map(renderBlock)}
                </div>
              )}

              {view === "edit" && (
                <div>
                  <div className="article-blocks-list">
                    {(article.blocks || []).map(renderBlock)}
                    {(article.blocks || []).length === 0 && <div className="empty-row">No blocks in this article.</div>}
                  </div>
                  {selectedBlocks.size > 0 && (
                    <div className="edit-actions">
                      <button className="admin-btn danger" onClick={handleDeleteSelected}>Delete {selectedBlocks.size} Block(s)</button>
                      <button className="admin-btn small" onClick={() => setSelectedBlocks(new Set())}>Clear Selection</button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="article-modal-footer">
          {canUpdate && view === "view" && <button className="admin-btn danger" onClick={() => onDelete(article.articleId)}>Delete Article</button>}
          <button className="admin-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
