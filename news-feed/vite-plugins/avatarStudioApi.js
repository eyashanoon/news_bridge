/**
 * Avatar Studio dev-server APIs (news-feed integration).
 *
 * WHY: Vite proxies /api → Java :8080, which has no TTS/Rhubarb routes (403).
 * This middleware handles avatar routes locally before the proxy runs.
 *
 * See: news-feed/public/avatar-studio/CHANGES.md
 */
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import decode from "audio-decode";

const execFileP = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Rhubarb must sit next to its res/ folder (full release, not exe-only).
// Supports both Windows (.exe) and Linux (no extension) binaries.
const RHUBARB_CANDIDATES = (() => {
  const linux = path.resolve(__dirname, "../tools/Rhubarb-Lip-Sync-1.14.0-Linux/rhubarb");
  const windows = path.resolve(__dirname, "../tools/Rhubarb-Lip-Sync-1.14.0-Windows/rhubarb.exe");
  const legacy = path.resolve(__dirname, "../../avatar/tools/rhubarb.exe");
  return process.platform === "win32"
    ? [windows, linux, legacy]
    : [linux, windows, legacy];
})();

const AVATAR_API_PATHS = new Set([
  "/api/tts-edge",
  "/api/azure-tts",
  "/api/rhubarb",
  "/api/tts",
  "/api/presenter-animation",
]);

const POSES_FILE = path.resolve(__dirname, "../data/avatar/poses.json");
const PRESENTER_ANIM_FILE = path.resolve(__dirname, "../data/avatar/presenter-animation.json");

function isAvatarApiPath(pathname) {
  if (AVATAR_API_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api/poses/")) return true;
  return false;
}

async function readAllPoses() {
  try {
    return JSON.parse(await fs.readFile(POSES_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function writeAllPoses(data) {
  await fs.mkdir(path.dirname(POSES_FILE), { recursive: true });
  await fs.writeFile(POSES_FILE, JSON.stringify(data, null, 2), "utf8");
}

async function readPresenterAnimation() {
  try {
    const raw = await fs.readFile(PRESENTER_ANIM_FILE, "utf8");
    const data = JSON.parse(raw);
    return {
      startR: data.startR ?? "",
      startL: data.startL ?? "",
      keyframes: Array.isArray(data.keyframes) ? data.keyframes : [],
    };
  } catch {
    return { startR: "", startL: "", keyframes: [] };
  }
}

async function writePresenterAnimation(config) {
  await fs.mkdir(path.dirname(PRESENTER_ANIM_FILE), { recursive: true });
  await fs.writeFile(
    PRESENTER_ANIM_FILE,
    JSON.stringify(
      {
        startR: config.startR ?? "",
        startL: config.startL ?? "",
        keyframes: Array.isArray(config.keyframes) ? config.keyframes : [],
      },
      null,
      2
    ),
    "utf8"
  );
}

async function handlePoses(req, res, part) {
  if (!["L", "R", "H"].includes(part)) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Invalid part" }));
    return;
  }
  if (req.method === "GET") {
    const all = await readAllPoses();
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(all[part] || {}));
    return;
  }
  if (req.method === "POST") {
    const body = await readBody(req);
    const poses = JSON.parse(body.toString("utf8"));
    const all = await readAllPoses();
    all[part] = poses;
    await writeAllPoses(all);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.statusCode = 405;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: "Method not allowed" }));
}

async function handlePresenterAnimation(req, res) {
  if (req.method === "GET") {
    const data = await readPresenterAnimation();
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data));
    return;
  }
  if (req.method === "POST") {
    const body = await readBody(req);
    const config = JSON.parse(body.toString("utf8"));
    await writePresenterAnimation(config);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.statusCode = 405;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: "Method not allowed" }));
}

function resolveRhubarbExe() {
  for (const candidate of RHUBARB_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  return RHUBARB_CANDIDATES[0];
}

function parseUrl(req) {
  return new URL(req.url ?? "/", "http://localhost");
}

function formatRate(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return "+0%";
  const pct = Math.round((n - 1) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

/** 16-bit PCM WAV for Rhubarb (from decoded MP3 or raw WAV upload). */
function pcmToWav(channelData, sampleRate) {
  const numCh = channelData.length;
  const len = channelData[0]?.length ?? 0;
  const bps = 2;
  const dataSize = numCh * len * bps;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(numCh, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * numCh * bps, 28);
  wav.writeUInt16LE(numCh * bps, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataSize, 40);
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, channelData[ch][i] ?? 0));
      wav.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7fff, off);
      off += 2;
    }
  }
  return wav;
}

async function toWavBytes(audioBytes, contentType = "") {
  if (audioBytes.length >= 4 && audioBytes.toString("ascii", 0, 4) === "RIFF") {
    return audioBytes;
  }
  const decoded = await decode(audioBytes);
  if (!decoded?.channelData?.length) {
    throw new Error("Could not decode audio for Rhubarb");
  }
  return pcmToWav(decoded.channelData, decoded.sampleRate);
}

async function handleTtsEdge(searchParams, res) {
  const text = searchParams.get("q") ?? "";
  const voice = searchParams.get("voice") ?? "en-US-AndrewNeural";
  const rate = searchParams.get("rate") ?? "1";
  if (!text.trim()) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Missing q parameter" }));
    return;
  }
  const { UniversalEdgeTTS } = await import("edge-tts-universal");
  const tts = new UniversalEdgeTTS(text, voice, { rate: formatRate(rate) });
  const result = await tts.synthesize();
  const audio = Buffer.from(await result.audio.arrayBuffer());
  res.statusCode = 200;
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Content-Length", audio.length);
  res.end(audio);
}

async function handleAzureTts(res) {
  // Avatar tts.js falls back to Edge when Azure is not configured.
  res.statusCode = 503;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: "Azure key not configured" }));
}

// ── Built-in text-to-cues (fallback when Rhubarb is unavailable) ──
// Same approach as avatar/server.js — estimates timing from word count
// and maps letters → visemes. Works on any platform without Rhubarb.

const LETTER_VISEME = {};
'aeiou'.split('').forEach(l => LETTER_VISEME[l] = 'E');
'bfmp'.split('').forEach(l => LETTER_VISEME[l] = 'B');
'w'.split('').forEach(l => LETTER_VISEME[l] = 'G');
'fv'.split('').forEach(l => LETTER_VISEME[l] = 'F');
'lntd'.split('').forEach(l => LETTER_VISEME[l] = 'H');
'sz'.split('').forEach(l => LETTER_VISEME[l] = 'C');
'c'.split('').forEach(l => LETTER_VISEME[l] = 'D');
'kg'.split('').forEach(l => LETTER_VISEME[l] = 'G');
'r'.split('').forEach(l => LETTER_VISEME[l] = 'D');
'j'.split('').forEach(l => LETTER_VISEME[l] = 'C');
'y'.split('').forEach(l => LETTER_VISEME[l] = 'E');
'h'.split('').forEach(l => LETTER_VISEME[l] = 'H');
'x'.split('').forEach(l => LETTER_VISEME[l] = 'X');

function getLetterViseme(ch) {
  return LETTER_VISEME[ch.toLowerCase()] ?? null;
}

function textToCues(text) {
  const avgWpm     = 140;
  const charsPerSec = (avgWpm * 5) / 60;
  const totalChars = text.length;
  const duration   = totalChars / charsPerSec;
  const cueLen     = Math.max(0.05, duration / Math.max(1, totalChars));

  const cues = [];
  let offset = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const viseme = getLetterViseme(ch);
    if (viseme) {
      const start = offset;
      const end   = start + cueLen;
      cues.push({ start, end, value: viseme });
    }
    offset += cueLen;
  }

  if (cues.length > 0) {
    const firstStart = cues[0].start;
    if (firstStart > 0.01) {
      cues.unshift({ start: 0, end: firstStart, value: 'X' });
    }
    const last = cues[cues.length - 1];
    cues.push({ start: last.end, end: last.end + 0.1, value: 'X' });
  }

  return { mouthCues: cues, metadata: { duration } };
}

async function handleRhubarb(req, searchParams, res) {
  const text = searchParams.get("text") ?? "";
  const audioBytes = await readBody(req);
  if (!audioBytes.length) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Empty audio body" }));
    return;
  }
  const rhubarbExe = resolveRhubarbExe();

  // Try Rhubarb if available (Windows), otherwise use built-in text-to-cues (Linux)
  if (existsSync(rhubarbExe)) {
    const id = crypto.randomUUID();
    const wavPath = path.join(os.tmpdir(), `avatar-rhubarb-${id}.wav`);
    const dialogPath = path.join(os.tmpdir(), `avatar-rhubarb-${id}.txt`);
    try {
      const wavBytes = await toWavBytes(audioBytes, req.headers["content-type"] ?? "");
      await fs.writeFile(wavPath, wavBytes);
      await fs.writeFile(dialogPath, text, "utf8");
      const { stdout } = await execFileP(
        rhubarbExe,
        ["--recognizer", "phonetic", "--exportFormat", "json", "--extendedShapes", "GH",
          "--dialogFile", dialogPath, wavPath],
        { timeout: 60_000, maxBuffer: 10 * 1024 * 1024, cwd: path.dirname(rhubarbExe) }
      );
      const json = JSON.parse(stdout);
      if (!json?.mouthCues?.length) throw new Error("Rhubarb returned no mouth cues");
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(stdout);
      return;
    } catch (err) {
      console.error("[avatar-studio-api] /api/rhubarb (rhubarb failed, falling back to text-to-cues):", err.message ?? err);
    } finally {
      await fs.unlink(wavPath).catch(() => {});
      await fs.unlink(dialogPath).catch(() => {});
    }
  }

  // Fallback: built-in text-to-cues (works on any platform)
  console.log("[avatar-studio-api] /api/rhubarb: using built-in text-to-cues");
  const result = textToCues(text);
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(result));
}

export function avatarStudioApi() {
  return {
    name: "avatar-studio-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const { pathname, searchParams } = parseUrl(req);
        if (!isAvatarApiPath(pathname)) return next();
        try {
          if (pathname === "/api/tts-edge" && req.method === "GET") {
            await handleTtsEdge(searchParams, res);
            return;
          }
          if (pathname === "/api/azure-tts" && req.method === "GET") {
            await handleAzureTts(res);
            return;
          }
          if (pathname === "/api/rhubarb" && req.method === "POST") {
            await handleRhubarb(req, searchParams, res);
            return;
          }
          if (pathname.startsWith("/api/poses/")) {
            const part = pathname.slice("/api/poses/".length);
            await handlePoses(req, res, part);
            return;
          }
          if (pathname === "/api/presenter-animation") {
            await handlePresenterAnimation(req, res);
            return;
          }
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
        } catch (err) {
          console.error("[avatar-studio-api]", pathname, err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: err.message ?? "Internal error" }));
          }
        }
      });
    },
  };
}

/** Vite proxy bypass: keep these paths on the dev server (see CHANGES.md). */
export function avatarApiProxyBypass(req) {
  if (isAvatarApiPath(parseUrl(req).pathname)) return req.url;
}
