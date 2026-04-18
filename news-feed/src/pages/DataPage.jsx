import { useState } from "react";
import { api, authConfig } from "../api";
import { useSession } from "../context/SessionContext";

export default function DataPage() {
  const { session, setNotice } = useSession();
  const [query, setQuery] = useState({ articleId: "", endpointId: "", rootId: "", userId: "", cacheId: "", sourceEndpointId: "" });
  const [lab, setLab] = useState({ method: "GET", path: "/articles/ids", body: "" });
  const [output, setOutput] = useState(null);

  async function run(label, fn) {
    try {
      const res = await fn();
      setOutput({ label, data: res.data ?? "No content" });
    } catch (err) {
      setNotice(err?.response?.data?.message || `${label} failed.`);
    }
  }

  const cfg = authConfig(session?.token);

  async function runLab(e) {
    e.preventDefault();
    const method = (lab.method || "GET").toUpperCase();
    try {
      const data = lab.body.trim() ? JSON.parse(lab.body) : undefined;
      const res = await api.request({
        method,
        url: lab.path,
        data,
        ...(session?.token ? authConfig(session.token) : {}),
      });
      setOutput({ label: `API LAB ${method} ${lab.path}`, data: res.data ?? "No content" });
    } catch (err) {
      setNotice(err?.response?.data?.message || err?.message || "API lab call failed.");
    }
  }

  return (
    <section>
      <div className="section-header">
        <h2>Data Explorer</h2>
        <p>Use all read/update/delete endpoints from one place.</p>
      </div>

      <div className="panel-grid two-cols">
        <div className="panel compact">
          <h3>Articles</h3>
          <input placeholder="Article ID" value={query.articleId} onChange={(e) => setQuery((p) => ({ ...p, articleId: e.target.value }))} />
          <input placeholder="Endpoint ID" value={query.endpointId} onChange={(e) => setQuery((p) => ({ ...p, endpointId: e.target.value }))} />
          <div className="btn-row">
            <button className="action" onClick={() => run("Article IDs", () => api.get("/articles/ids"))}>IDs</button>
            <button className="action" onClick={() => run("Article By Id", () => api.get(`/articles/${query.articleId}`))}>By ID</button>
            <button className="action" onClick={() => run("Article Blocks", () => api.get(`/articles/${query.articleId}/blocks`))}>Blocks</button>
            <button className="action" onClick={() => run("Articles by endpoint", () => api.get(`/articles?endpointId=${query.endpointId}`))}>By Endpoint</button>
            <button className="action danger" onClick={() => run("Delete Article", () => api.delete(`/articles/${query.articleId}`, cfg))}>Delete</button>
          </div>
        </div>

        <div className="panel compact">
          <h3>Roots & Endpoints</h3>
          <input placeholder="Root ID" value={query.rootId} onChange={(e) => setQuery((p) => ({ ...p, rootId: e.target.value }))} />
          <input placeholder="Endpoint ID" value={query.endpointId} onChange={(e) => setQuery((p) => ({ ...p, endpointId: e.target.value }))} />
          <div className="btn-row">
            <button className="action" onClick={() => run("Roots", () => api.get("/roots"))}>Roots</button>
            <button className="action" onClick={() => run("Root by Id", () => api.get(`/roots/${query.rootId}`))}>Root by ID</button>
            <button className="action" onClick={() => run("Endpoint by Id", () => api.get(`/endpoints/${query.endpointId}`))}>Endpoint by ID</button>
            <button className="action" onClick={() => run("Endpoints by Root", () => api.get(`/endpoints?rootId=${query.rootId}`))}>By Root</button>
            <button className="action danger" onClick={() => run("Delete Endpoint", () => api.delete(`/endpoints/${query.endpointId}`, cfg))}>Delete Endpoint</button>
          </div>
        </div>

        <div className="panel compact">
          <h3>Cache Endpoints</h3>
          <input placeholder="Cache Endpoint ID" value={query.cacheId} onChange={(e) => setQuery((p) => ({ ...p, cacheId: e.target.value }))} />
          <input placeholder="Source Endpoint ID" value={query.sourceEndpointId} onChange={(e) => setQuery((p) => ({ ...p, sourceEndpointId: e.target.value }))} />
          <input placeholder="Cache URL (for query)" value={query.cacheUrl || ""} onChange={(e) => setQuery((p) => ({ ...p, cacheUrl: e.target.value }))} />
          <div className="btn-row">
            <button className="action" onClick={() => run("Cache all", () => api.get("/cache-endpoints/all"))}>All</button>
            <button className="action" onClick={() => run("Cache by id", () => api.get(`/cache-endpoints/${query.cacheId}`))}>By ID</button>
            <button className="action" onClick={() => run("Cache by source", () => api.get(`/cache-endpoints/by-source?sourceEndpointId=${query.sourceEndpointId}`))}>By Source</button>
            <button className="action" onClick={() => run("Cache by source+url", () => api.get(`/cache-endpoints?sourceEndpointId=${query.sourceEndpointId}&url=${encodeURIComponent(query.cacheUrl || "")}`))}>By Source+URL</button>
            <button className="action danger" onClick={() => run("Delete cache", () => api.delete(`/cache-endpoints/${query.cacheId}`, cfg))}>Delete Cache</button>
          </div>
        </div>

        <div className="panel compact">
          <h3>Users, Blocks, Titles</h3>
          <input placeholder="User ID" value={query.userId} onChange={(e) => setQuery((p) => ({ ...p, userId: e.target.value }))} />
          <input placeholder="Article Block/Title ID" value={query.blockId || ""} onChange={(e) => setQuery((p) => ({ ...p, blockId: e.target.value }))} />
          <div className="btn-row">
            <button className="action" onClick={() => run("Users", () => api.get("/users", cfg))}>Users</button>
            <button className="action" onClick={() => run("User by id", () => api.get(`/users/${query.userId}`, cfg))}>User by ID</button>
            <button className="action danger" onClick={() => run("Delete user", () => api.delete(`/users/${query.userId}`, cfg))}>Delete User</button>
            <button className="action" onClick={() => run("Article blocks", () => api.get("/article-blocks", cfg))}>Blocks</button>
            <button className="action" onClick={() => run("Article titles", () => api.get("/article-titles", cfg))}>Titles</button>
          </div>
        </div>
      </div>

      <div className="panel output">
        <h3>Response</h3>
        <pre>{JSON.stringify(output, null, 2)}</pre>
      </div>

      <form className="panel" onSubmit={runLab}>
        <h3>API Lab (Any Endpoint)</h3>
        <p>Use this for all remaining APIs and custom payload testing.</p>
        <div className="btn-row">
          <select value={lab.method} onChange={(e) => setLab((p) => ({ ...p, method: e.target.value }))}>
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>DELETE</option>
          </select>
          <input value={lab.path} onChange={(e) => setLab((p) => ({ ...p, path: e.target.value }))} placeholder="/articles/ids" required />
        </div>
        <textarea
          value={lab.body}
          onChange={(e) => setLab((p) => ({ ...p, body: e.target.value }))}
          placeholder='Optional JSON body, e.g. {"name":"Root","baseUrl":"https://site.com"}'
        />
        <button className="action" type="submit">Run API Call</button>
      </form>
    </section>
  );
}