import { useState, useEffect, useCallback } from "react";
import { api, authConfig } from "../../api";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { hasRole } from "../utils/roles";
import { ArticleDetailModal } from "./ArticleDetailModal";
import { formatCollectedAt } from "../utils/formatters";

export function ManageArticles({ session }) {
  const [articles, setArticles] = useState([]);
  const [roots, setRoots] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [articlePage, setArticlePage] = useState(0);
  const [articleSearch, setArticleSearch] = useState("");
  const [articleRootId, setArticleRootId] = useState("");
  const [articleEndpointId, setArticleEndpointId] = useState("");
  const [articleTotal, setArticleTotal] = useState(0);
  const [articleTotalPages, setArticleTotalPages] = useState(0);
  const [articleDetail, setArticleDetail] = useState(null);
  const [articleDetailLoading, setArticleDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const { askConfirm, Dialog } = useConfirmDialog();

  const cfg = authConfig(session.token);
  const canUpdate = hasRole(session, "UPDATE_ANY_ARTICLE");
  const canDelete = hasRole(session, "DELETE_ANY_ARTICLE");

  const loadRoots = useCallback(async () => {
    try {
      const res = await api.get(`/roots`, cfg);
      setRoots(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load roots");
    }
  }, [session.token]);

  const loadEndpoints = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (articleRootId) params.set("rootId", articleRootId);
      const res = await api.get(`/endpoints${params.toString() ? `?${params.toString()}` : ""}`, cfg);
      setEndpoints(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load endpoints");
    }
  }, [session.token, articleRootId]);

  const loadArticles = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("page", String(articlePage));
      params.set("size", String(20));
      if (articleSearch) params.set("search", articleSearch);
      if (articleRootId) params.set("rootId", articleRootId);
      if (articleEndpointId) params.set("endpointId", articleEndpointId);
      const res = await api.get(`/articles/admin?${params.toString()}`, cfg);
      setArticles(res.data.items || []);
      setArticleTotal(res.data.total || 0);
      setArticleTotalPages(res.data.totalPages || 0);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load articles");
    }
  }, [session.token, articlePage, articleSearch, articleRootId, articleEndpointId]);

  useEffect(() => { loadRoots(); }, [loadRoots]);
  useEffect(() => { loadEndpoints(); }, [loadEndpoints]);
  useEffect(() => { loadArticles(); }, [loadArticles]);

  const loadArticleDetail = async (id) => {
    setArticleDetailLoading(true);
    try {
      const res = await api.get(`/articles/${id}/blocks`, cfg);
      setArticleDetail(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load article details");
    } finally {
      setArticleDetailLoading(false);
    }
  };

  const handleDeleteArticle = async (id) => {
    const ok = await askConfirm("Delete this article permanently?");
    if (!ok) return;
    try {
      await api.delete(`/articles/${id}`, cfg);
      setArticleDetail(null);
      loadArticles();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete article");
    }
  };

  const handleDeleteBlock = async (articleId, blockId) => {
    const ok = await askConfirm("Delete this block from article?");
    if (!ok) return;
    try {
      await api.delete(`/articles/${articleId}/blocks/${blockId}`, cfg);
      loadArticleDetail(articleId);
      loadArticles();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete block");
    }
  };

  const endpointOptions = endpoints.filter((ep) => !articleRootId || String(ep.rootId) === String(articleRootId));

  return (
    <div>
      <div className="admin-page-header">
        <h2>Manage Articles</h2>
        <p>View, edit, and delete article content and blocks</p>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-filters-row">
        <input
          className="admin-search"
          placeholder="Search title, URL, or content"
          value={articleSearch}
          onChange={(e) => { setArticleSearch(e.target.value); setArticlePage(0); }}
        />
        <select className="admin-select" value={articleRootId} onChange={(e) => { setArticleRootId(e.target.value); setArticleEndpointId(""); setArticlePage(0); }}>
          <option value="">All roots</option>
          {roots.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select className="admin-select" value={articleEndpointId} onChange={(e) => { setArticleEndpointId(e.target.value); setArticlePage(0); }}>
          <option value="">All endpoints</option>
          {endpointOptions.map((ep) => <option key={ep.id} value={ep.id}>{ep.url}</option>)}
        </select>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>ID</th><th>Title</th><th>Root</th><th>Endpoint</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {articles.map((a) => (
              <tr key={a.id}>
                <td>{a.id}</td>
                <td className="title-cell">{a.title || "-"}</td>
                <td>{a.rootName || "-"}</td>
                <td className="url-cell"><a href={a.endpointUrl} target="_blank" rel="noopener noreferrer">{a.endpointUrl?.substring(0, 45)}{a.endpointUrl?.length > 45 ? "..." : ""}</a></td>
                <td>{formatCollectedAt(a.createdAt)}</td>
                <td className="action-cell">
                  <button className="admin-btn small" onClick={() => loadArticleDetail(a.id)}>View</button>
                  {canDelete && <button className="admin-btn small danger" onClick={() => handleDeleteArticle(a.id)}>Delete</button>}
                </td>
              </tr>
            ))}
            {articles.length === 0 && <tr><td colSpan="6" className="empty-row">No articles found</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="admin-pagination-row">
        <span>Page {articlePage + 1} / {Math.max(articleTotalPages, 1)} ({articleTotal} items)</span>
        <div className="action-cell">
          <button className="admin-btn small" disabled={articlePage <= 0} onClick={() => setArticlePage((p) => Math.max(0, p - 1))}>Previous</button>
          <button className="admin-btn small" disabled={articlePage + 1 >= articleTotalPages} onClick={() => setArticlePage((p) => p + 1)}>Next</button>
        </div>
      </div>

      {articleDetail && (
        <ArticleDetailModal article={articleDetail} loading={articleDetailLoading} onClose={() => setArticleDetail(null)} onDelete={handleDeleteArticle} onDeleteBlock={handleDeleteBlock} canUpdate={canUpdate} askConfirm={askConfirm} />
      )}
      {Dialog}
    </div>
  );
}
