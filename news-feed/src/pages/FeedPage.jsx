import { useEffect, useState } from "react";
import { api } from "../api";
import { useSession } from "../context/SessionContext";
import ArticleCard from "../components/article/ArticleCard";
import ArticleOverlay from "../components/article/ArticleOverlay";

function FeedArticle({ id, canInteract }) {
  const [article, setArticle] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [localNotice, setLocalNotice] = useState("");

  useEffect(() => {
    api.get(`/articles/${id}/blocks`).then((r) => setArticle(r.data)).catch(() => {});
  }, [id]);

  if (!article) return <div className="article-placeholder">Loading article {id}...</div>;

  return (
    <>
      <ArticleCard article={article} onExpand={() => setExpanded(true)} />

      {canInteract && (
        <div className="panel compact">
          <div className="btn-row">
            <button className="btn btn-secondary btn-sm" onClick={() => setLocalNotice("Reaction saved")}>React</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowComments((prev) => !prev)}>Comments</button>
          </div>
          {localNotice && <div className="notice">{localNotice}</div>}
          {showComments && (
            <div className="comments-section">
              <input type="text" placeholder="Write a comment..." className="form-control" />
              <button className="btn btn-primary btn-sm" style={{ marginTop: "8px" }} onClick={() => setLocalNotice("Comment posted")}>Post</button>
            </div>
          )}
        </div>
      )}

      {expanded && <ArticleOverlay article={article} onClose={() => setExpanded(false)} />}
    </>
  );
}

export default function FeedPage() {
  const [ids, setIds] = useState([]);
  const { session, notice, editorMode } = useSession();

  const isRegistered = session?.type === "REGISTERED";
  const isEditor = session?.type === "EDITOR";
  const canInteract = isRegistered || (isEditor && editorMode === "registered");

  useEffect(() => {
    api.get("/articles/ids").then(res => setIds(res.data || [])).catch(()=> {
      // Mock Data offline
      setIds([101, 102, 103]);
    });
  }, []);

  return (
    <div className="feed-page">
      <header className="feed-header">
        <h1>Latest News {canInteract ? "(Registered Mode)" : ""}</h1>
      </header>
      {notice && <div className="notice">{notice}</div>}
      <div className="feed">
        {ids.map((id) => <FeedArticle key={id} id={id} canInteract={canInteract} />)}
      </div>
    </div>
  );
}