/**
 * server.js — Speech + Rhubarb Lip Sync backend
 *
 * POST /api/speak  { text: string }
 *   1. Generates a WAV file via TTS
 *      - Windows: uses SAPI via PowerShell
 *      - Linux:   uses espeak-ng
 *   2. Runs Rhubarb Lip Sync on the WAV to get precise mouth-shape cues
 *      - On Linux, rhubarb.exe is run via wine
 *   3. Returns { audioUrl: string, cues: [{start, end, value}], duration: number }
 *
 * GET /audio/:file — serves the generated WAV files
 *
 * Mouth-shape values (A-H, X) match the shape keys baked into avatar.glb.
 * Rhubarb's extended shapes G and H are enabled since we have those keys.
 */

import express    from 'express';
import { execFile, execSync }  from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync }               from 'fs';
import path                         from 'path';
import { fileURLToPath }            from 'url';
import crypto                       from 'crypto';
import os                           from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execFileP  = promisify(execFile);

const TEMP_DIR = path.join(__dirname, 'temp');
const RHUBARB  = path.join(__dirname, 'tools', 'rhubarb.exe');
const PORT     = 3001;

// ── Platform detection ──────────────────────────────────────────────────────────
const IS_WINDOWS = os.platform() === 'win32';
const IS_LINUX   = os.platform() === 'linux';

if (!existsSync(TEMP_DIR)) await mkdir(TEMP_DIR, { recursive: true });

// ── Express setup ─────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// Allow cross-origin requests from the Vite dev server (and any origin)
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
app.options('/api/speak', (_req, res) => res.sendStatus(204));

// Serve generated WAV files
app.use('/audio', express.static(TEMP_DIR, { maxAge: 0 }));

// ── TTS → WAV ──────────────────────────────────────────────────────────────────

// Windows: SAPI via PowerShell
async function textToWavWindows(text, wavPath) {
  const safeText = text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/[\r\n]+/g, ' ');

  const safeWav = wavPath.replace(/\\/g, '\\\\');

  const ps = [
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    '$v = $s.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo }',
    '$pick = ($v | Where-Object { $_.Name -match "Guy" } | Select-Object -First 1)',
    'if (-not $pick) { $pick = ($v | Where-Object { $_.Name -match "Christopher|Davis|Andrew|Brian" } | Select-Object -First 1) }',
    'if (-not $pick) { $pick = ($v | Where-Object { $_.Name -match "David" } | Select-Object -First 1) }',
    'if (-not $pick) { $pick = ($v | Where-Object { $_.Culture -match "en-US|en-GB" -and $_.Gender -ne "Female" } | Select-Object -First 1) }',
    'if ($pick) { $s.SelectVoice($pick.Name) }',
    '$s.Rate   = -2',
    '$s.Volume = 100',
    `$s.SetOutputToWaveFile('${safeWav}')`,
    `$s.Speak('${safeText}')`,
    '$s.Dispose()',
  ].join('; ');

  await execFileP('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps]);
}

// Linux: edge-tts (Microsoft Edge TTS — natural voices, not robotic)
// Falls back to espeak-ng if edge-tts fails (no internet)
async function textToWavLinux(text, wavPath) {
  const safeText = text.replace(/[\r\n]+/g, ' ');

  try {
    // Use Christopher (male, news style — same quality as Windows SAPI)
    await execFileP('edge-tts', [
      '--voice',   'en-US-ChristopherNeural',
      '--rate',    '-20%',
      '--text',    safeText,
      '--write-media', wavPath,
    ]);
    return;
  } catch (edgeErr) {
    console.log('[speak] edge-tts failed, falling back to espeak-ng:', edgeErr.message.slice(0, 60));
  }

  // Fallback: espeak-ng
  await execFileP('espeak-ng', [
    '-w', wavPath,
    '-s', '120',
    '-p', '50',
    '-a', '150',
    safeText,
  ]);
}

// Dispatch to the correct platform TTS
async function textToWav(text, wavPath) {
  if (IS_WINDOWS) {
    return textToWavWindows(text, wavPath);
  }
  // Linux (or other)
  return textToWavLinux(text, wavPath);
}

// ── Lip-sync cue generation ────────────────────────────────────────────────────
//
// On Windows we run Rhubarb.exe for precise phoneme-to-viseme mapping.
// On Linux (where the .exe can't run without wine + missing model files),
// we use a built-in JavaScript text-to-cues engine that estimates timing
// from word count and maps letters → visemes.
//
// The cues array follows the same format Rhubarb returns:
//   [{start: number, end: number, value: 'A'|'B'|...|'X'}]

// Letter → viseme map (best-effort)
const LETTER_VISEME = {};
'aeiou'.split('').forEach(l => LETTER_VISEME[l] = 'E');  // wide open
'bfmp'.split('').forEach(l => LETTER_VISEME[l] = 'B');   // closed bilabial
'w'.split('').forEach(l => LETTER_VISEME[l] = 'G');      // rounded
'fv'.split('').forEach(l => LETTER_VISEME[l] = 'F');     // teeth on lip
'lntd'.split('').forEach(l => LETTER_VISEME[l] = 'H');   // tongue up
'sz'.split('').forEach(l => LETTER_VISEME[l] = 'C');     // slightly open
'c'.split('').forEach(l => LETTER_VISEME[l] = 'D');      // open
'kg'.split('').forEach(l => LETTER_VISEME[l] = 'G');     // back of mouth
'r'.split('').forEach(l => LETTER_VISEME[l] = 'D');      // open
'j'.split('').forEach(l => LETTER_VISEME[l] = 'C');      // palatal
'y'.split('').forEach(l => LETTER_VISEME[l] = 'E');      // wide
'h'.split('').forEach(l => LETTER_VISEME[l] = 'H');      // breath
'x'.split('').forEach(l => LETTER_VISEME[l] = 'X');      // rest

function getLetterViseme(ch) {
  return LETTER_VISEME[ch.toLowerCase()] ?? null;
}

// Generate cues from text for when Rhubarb is unavailable
function textToCues(text) {
  const avgWpm     = 140;          // espeak-ng default
  const charsPerSec = (avgWpm * 5) / 60; // ~11.7 chars/sec
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

  // Add rest cue before and after for natural feel
  if (cues.length > 0) {
    // Insert a brief X at the beginning
    const firstStart = cues[0].start;
    if (firstStart > 0.01) {
      cues.unshift({ start: 0, end: firstStart, value: 'X' });
    } else {
      // First real cue starts immediately; don't insert a zero-length X
    }
    // Insert X at end
    const last = cues[cues.length - 1];
    cues.push({ start: last.end, end: last.end + 0.1, value: 'X' });
  }

  return { mouthCues: cues, metadata: { duration } };
}

async function runRhubarb(wavPath, text, dialogPath) {
  if (IS_WINDOWS) {
    // Windows: use Rhubarb.exe directly
    await writeFile(dialogPath, text, 'utf8');
    const { stdout } = await execFileP(RHUBARB,
      ['--recognizer', 'phonetic', '--exportFormat', 'json',
       '--extendedShapes', 'GH', '--dialogFile', dialogPath, wavPath],
      { timeout: 60_000 });
    return JSON.parse(stdout);
  }

  // Linux: generate cues from text directly
  console.log('[speak] Using built-in text-to-cues (Rhubarb unavailable on Linux)');
  return textToCues(text);
}

// ── POST /api/speak ───────────────────────────────────────────────────────────
app.post('/api/speak', async (req, res) => {
  const text = String(req.body?.text ?? '').trim();
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const id         = crypto.randomUUID();
  const wavPath    = path.join(TEMP_DIR, `${id}.wav`);
  const dialogPath = path.join(TEMP_DIR, `${id}.txt`);

  try {
    console.log(`[speak] "${text.slice(0, 70)}${text.length > 70 ? '…' : ''}"`);

    // Step 1: TTS → WAV
    const t0 = Date.now();
    await textToWav(text, wavPath);
    console.log(`[speak] WAV ready in ${Date.now() - t0} ms`);

    // Step 2: Rhubarb → mouth cues
    const t1 = Date.now();
    const data = await runRhubarb(wavPath, text, dialogPath);
    console.log(`[speak] Rhubarb: ${data.mouthCues.length} cues, ${data.metadata?.duration?.toFixed(2)}s audio — ${Date.now() - t1} ms`);

    // Clean up dialog file immediately; WAV is deleted after 5 min
    unlink(dialogPath).catch(() => {});
    setTimeout(() => unlink(wavPath).catch(() => {}), 5 * 60 * 1000);

    res.json({
      audioUrl: `/audio/${id}.wav`,
      cues:     data.mouthCues,     // [{start:number, end:number, value:'A'|'B'|…|'X'}]
      duration: data.metadata?.duration ?? 0,
    });

  } catch (err) {
    console.error('[speak] Error:', err.message);
    unlink(wavPath).catch(() => {});
    unlink(dialogPath).catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\nSpeech server → http://localhost:${PORT}`);
  console.log(`Rhubarb      : ${RHUBARB}`);
  console.log(`Temp dir     : ${TEMP_DIR}\n`);
});
