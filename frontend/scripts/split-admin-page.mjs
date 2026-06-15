import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const lines = fs.readFileSync(path.join(root, "src/pages/AdminPage.jsx"), "utf8").split(/\r?\n/);

const STANDARD_IMPORTS = `import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, authConfig } from "../../api";
import ChannelOnboardingModal from "../../components/ChannelOnboardingModal";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { hasRole } from "../utils/roles";
import { resolveAvatar, displayNameFromEmail } from "../utils/avatars";
import {
  ADMIN_ROLES,
  REGISTERED_ROLE_OPTIONS,
  EDITOR_ROLE_OPTIONS,
  USER_STATUSES,
} from "../constants/roles";
`;

const sections = [
  { name: "DashboardOverview", start: 164, end: 190, imports: `import { useState, useEffect } from "react";
import { getDashboardStats } from "../services/dashboardService";
import { StatCard } from "../design-system/StatCard";
` },
  { name: "ManageAdmins", start: 201, end: 385 },
  { name: "ManageUsers", start: 387, end: 679 },
  { name: "ManageArticles", start: 683, end: 843, imports: `import { useState, useEffect, useCallback } from "react";
import { api, authConfig } from "../../api";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { hasRole } from "../utils/roles";
import { ArticleDetailModal } from "./ArticleDetailModal";
` },
  { name: "TrustWidgets", start: 845, end: 907, imports: `import { useState } from "react";
` },
  { name: "ManageRoots", start: 909, end: 1392, imports: `import { useState, useEffect, useCallback, useRef } from "react";
import { api, authConfig } from "../../api";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { DiscoveryPanel } from "./DiscoveryPanel";
import { BiasChip, ReliabilityBar, TrustGauge } from "./TrustWidgets";
` },
  { name: "DiscoveryPanel", start: 1394, end: 1628, imports: `import { useState, useEffect, useRef } from "react";
` },
  { name: "ManageEndpoints", start: 1632, end: 1821 },
  { name: "ArticleDetailModal", start: 1824, end: 1951, imports: `import { useState } from "react";
` },
  { name: "EditorRequests", start: 1954, end: 2039 },
  { name: "ManageCrawler", start: 2042, end: 2065, imports: `import { useState } from "react";
import { hasRole } from "../utils/roles";
import { ArticleCrawlerPanel } from "./ArticleCrawlerPanel";
import { TelegramCrawlerPanel } from "./TelegramCrawlerPanel";
` },
  { name: "ArticleCrawlerPanel", start: 2068, end: 2403 },
  { name: "ManageFields", start: 2407, end: 2551 },
  { name: "ManageEvents", start: 2557, end: 2777 },
  { name: "TelegramCrawlerPanel", start: 2780, end: 3061 },
  { name: "ManageTelegram", start: 3064, end: 3403 },
];

const outDir = path.join(root, "src/admin/features");
fs.mkdirSync(outDir, { recursive: true });

function transform(body) {
  return body
    .replace(/useAdminDialog\(\)/g, "useConfirmDialog()")
    .replace(/^function /gm, "export function ");
}

for (const s of sections) {
  let body = lines.slice(s.start - 1, s.end).join("\n");
  body = transform(body);

  if (s.name === "DashboardOverview") {
    body = body.replace(
      /api\.get\("\/api\/admin\/dashboard\/stats", authConfig\(session\.token\)\)\s*\.then\(\(res\) => setStats\(res\.data\)\)/,
      "getDashboardStats(session.token).then(setStats)"
    );
  }

  const imports = s.imports || STANDARD_IMPORTS;
  fs.writeFileSync(path.join(outDir, `${s.name}.jsx`), `${imports}\n${body}\n`);
  console.log("Wrote", s.name, `(${s.end - s.start + 1} lines)`);
}

// Re-export alias
fs.writeFileSync(
  path.join(outDir, "ManageTopics.jsx"),
  `export { ManageEvents as ManageTopics } from "./ManageEvents";\n`
);

console.log("Done");
