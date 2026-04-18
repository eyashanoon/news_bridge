import { useState } from "react";
import { api, authConfig } from "../api";
import { useSession } from "../context/SessionContext";

const initialRoot = { name: "", baseUrl: "" };
const initialEndpoint = { url: "", rootId: "" };
const initialCache = { url: "", result: "UNKNOWN", sourceEndpointId: "", extractedText: "", extractedTitle: "", extractedContentJson: "", domPattern: "" };
const initialArticle = { url: "", title: "", text: "", endpointId: "", cacheEndpointId: "" };

export default function CmsPage() {
  const { session, setNotice } = useSession();
  const [root, setRoot] = useState(initialRoot);
  const [endpoint, setEndpoint] = useState(initialEndpoint);
  const [cache, setCache] = useState(initialCache);
  const [article, setArticle] = useState(initialArticle);

  const cfg = authConfig(session?.token);

  async function submit(handler) {
    try {
      await handler();
      setNotice("Operation completed.");
    } catch (err) {
      setNotice(err?.response?.data?.message || "Operation failed.");
    }
  }

  return (
    <section>
      <div className="section-header">
        <h2>CMS API Tools</h2>
        <p>Create entities for roots, endpoints, cache endpoints, and articles.</p>
      </div>
      <div className="panel-grid two-cols">
        <form className="panel" onSubmit={(e) => { e.preventDefault(); submit(() => api.post("/roots", root, cfg)); }}>
          <h3>Create Root</h3>
          <input placeholder="Name" value={root.name} onChange={(e) => setRoot((p) => ({ ...p, name: e.target.value }))} required />
          <input placeholder="Base URL" value={root.baseUrl} onChange={(e) => setRoot((p) => ({ ...p, baseUrl: e.target.value }))} required />
          <button className="action" type="submit">Create Root</button>
        </form>

        <form className="panel" onSubmit={(e) => { e.preventDefault(); submit(() => api.post("/endpoints", { ...endpoint, rootId: Number(endpoint.rootId) }, cfg)); }}>
          <h3>Create Endpoint</h3>
          <input placeholder="URL" value={endpoint.url} onChange={(e) => setEndpoint((p) => ({ ...p, url: e.target.value }))} required />
          <input placeholder="Root ID" value={endpoint.rootId} onChange={(e) => setEndpoint((p) => ({ ...p, rootId: e.target.value }))} required />
          <button className="action" type="submit">Create Endpoint</button>
        </form>

        <form className="panel" onSubmit={(e) => {
          e.preventDefault();
          submit(() => api.post("/cache-endpoints", { ...cache, sourceEndpointId: Number(cache.sourceEndpointId) }, cfg));
        }}>
          <h3>Create Cache Endpoint</h3>
          <input placeholder="URL" value={cache.url} onChange={(e) => setCache((p) => ({ ...p, url: e.target.value }))} required />
          <input placeholder="Analysis Result (UNKNOWN/GOOD/BAD)" value={cache.result} onChange={(e) => setCache((p) => ({ ...p, result: e.target.value }))} required />
          <input placeholder="Source Endpoint ID" value={cache.sourceEndpointId} onChange={(e) => setCache((p) => ({ ...p, sourceEndpointId: e.target.value }))} required />
          <input placeholder="Extracted Title" value={cache.extractedTitle} onChange={(e) => setCache((p) => ({ ...p, extractedTitle: e.target.value }))} />
          <button className="action" type="submit">Create Cache Endpoint</button>
        </form>

        <form className="panel" onSubmit={(e) => {
          e.preventDefault();
          submit(() => api.post("/articles", { ...article, endpointId: Number(article.endpointId), cacheEndpointId: Number(article.cacheEndpointId), blocks: [] }, cfg));
        }}>
          <h3>Create Article</h3>
          <input placeholder="URL" value={article.url} onChange={(e) => setArticle((p) => ({ ...p, url: e.target.value }))} required />
          <input placeholder="Title" value={article.title} onChange={(e) => setArticle((p) => ({ ...p, title: e.target.value }))} required />
          <textarea placeholder="Text" value={article.text} onChange={(e) => setArticle((p) => ({ ...p, text: e.target.value }))} />
          <input placeholder="Endpoint ID" value={article.endpointId} onChange={(e) => setArticle((p) => ({ ...p, endpointId: e.target.value }))} required />
          <input placeholder="Cache Endpoint ID" value={article.cacheEndpointId} onChange={(e) => setArticle((p) => ({ ...p, cacheEndpointId: e.target.value }))} required />
          <button className="action" type="submit">Create Article</button>
        </form>
      </div>
    </section>
  );
}