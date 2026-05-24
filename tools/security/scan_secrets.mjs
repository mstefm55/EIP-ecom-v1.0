import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const IGNORED_DIRS = new Set([
  ".git",
  ".vercel",
  "assets",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "reports",
  "sites"
]);

const IGNORED_FILES = new Set([
  "package-lock.json"
]);

const IGNORED_EXTENSIONS = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".ttf",
  ".webp",
  ".woff",
  ".woff2",
  ".zip"
]);

const SECRET_RULES = [
  {
    id: "private-key",
    pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/
  },
  {
    id: "aws-access-key-id",
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/
  },
  {
    id: "github-token",
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{36,255}\b/
  },
  {
    id: "google-api-key",
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/
  },
  {
    id: "stripe-live-secret-key",
    pattern: /\bsk_live_[0-9A-Za-z]{20,}\b/
  },
  {
    id: "brevo-api-key",
    pattern: /\bxkeysib-[A-Za-z0-9_-]{30,}\b/
  },
  {
    id: "slack-token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/
  }
];

function shouldSkipDir(name) {
  return IGNORED_DIRS.has(name);
}

function shouldSkipFile(filePath) {
  const name = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  if (name === ".env" || name.startsWith(".env.")) return true;
  if (name === "cookies.txt" || name === "session.json" || name.endsWith(".cookie") || name.endsWith(".cookies")) {
    return true;
  }
  return IGNORED_FILES.has(name) || IGNORED_EXTENSIONS.has(ext);
}

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!shouldSkipDir(entry.name)) yield* walk(fullPath);
      continue;
    }
    if (entry.isFile() && !shouldSkipFile(fullPath)) {
      yield fullPath;
    }
  }
}

function isLikelyBinary(buffer) {
  return buffer.includes(0);
}

function relative(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}

const findings = [];

for await (const filePath of walk(repoRoot)) {
  const stat = await fs.stat(filePath);
  if (stat.size > 1024 * 1024) continue;

  const buffer = await fs.readFile(filePath);
  if (isLikelyBinary(buffer)) continue;

  const text = buffer.toString("utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (line.includes("security-scan-ignore")) return;
    for (const rule of SECRET_RULES) {
      if (rule.pattern.test(line)) {
        findings.push({
          file: relative(filePath),
          line: index + 1,
          rule: rule.id
        });
      }
    }
  });
}

if (findings.length > 0) {
  console.error("Potential committed secrets were detected. Values are intentionally not printed.");
  findings.forEach((finding) => {
    console.error(`${finding.file}:${finding.line} ${finding.rule}`);
  });
  process.exit(1);
}

console.log("Secret scan passed: no high-confidence committed secrets found.");
