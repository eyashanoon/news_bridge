import { useState } from "react";
import { hasRole } from "../utils/roles";
import { ArticleCrawlerPanel } from "./ArticleCrawlerPanel";
import { TelegramCrawlerPanel } from "./TelegramCrawlerPanel";

export function ManageCrawler({ session }) {
  const [crawlerTab, setCrawlerTab] = useState("article");

  return (
    <div className="crawler-panel">
      <div className="admin-page-header">
        <h2>Crawler Control Centre</h2>
        <p>Manage article and Telegram crawlers from one dashboard</p>
      </div>
      <div className="crawler-tab-bar">
        <button className={`crawler-tab-btn ${crawlerTab === "article" ? "active" : ""}`} onClick={() => setCrawlerTab("article")}>
          Article Crawler
        </button>
        {hasRole(session, "CONTROL_TELEGRAM_CRAWLER", "VIEW_TELEGRAM_POSTS") && (
          <button className={`crawler-tab-btn ${crawlerTab === "telegram" ? "active" : ""}`} onClick={() => setCrawlerTab("telegram")}>
            Telegram Crawler
          </button>
        )}
      </div>
      {crawlerTab === "article" && <ArticleCrawlerPanel session={session} />}
      {crawlerTab === "telegram" && <TelegramCrawlerPanel session={session} />}
    </div>
  );
}
