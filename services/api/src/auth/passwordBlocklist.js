import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_BLOCKLIST_PATH = path.join(__dirname, "common_passwords_v1.txt");

const LEET_MAP = new Map([
  ["0", "o"],
  ["1", "i"],
  ["3", "e"],
  ["4", "a"],
  ["5", "s"],
  ["7", "t"],
  ["@", "a"],
  ["$", "s"],
  ["!", "i"]
]);

function normalizePasswordCandidate(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9@$!]/g, "");
}

function leetNormalize(value) {
  return normalizePasswordCandidate(value)
    .split("")
    .map((ch) => LEET_MAP.get(ch) || ch)
    .join("");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function parseBlocklistLine(line) {
  const text = String(line || "").trim();
  if (!text || text.startsWith("#")) return null;
  if (/^sha256:/i.test(text)) {
    const hash = text.slice("sha256:".length).trim().toLowerCase();
    return /^[a-f0-9]{64}$/.test(hash) ? { type: "hash", value: hash } : null;
  }
  if (/^[a-f0-9]{64}$/i.test(text)) return { type: "hash", value: text.toLowerCase() };
  const normalized = normalizePasswordCandidate(text);
  return normalized ? { type: "plain", value: normalized } : null;
}

function loadBlocklistFile(filePath) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    return text
      .split(/\r?\n/)
      .map(parseBlocklistLine)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function loadPasswordBlocklist() {
  const sources = [DEFAULT_BLOCKLIST_PATH];
  const external = String(process.env.PASSWORD_BLOCKLIST_PATH || "").trim();
  if (external) sources.push(external);

  const plain = new Set();
  const hashes = new Set();
  for (const source of sources) {
    for (const entry of loadBlocklistFile(source)) {
      if (entry.type === "hash") hashes.add(entry.value);
      if (entry.type === "plain") plain.add(entry.value);
    }
  }
  return { plain, hashes };
}

const BLOCKLIST = loadPasswordBlocklist();

function containsCommonPasswordToken(normalized) {
  if (normalized.length < 12) return false;
  for (const candidate of BLOCKLIST.plain) {
    if (candidate.length >= 6 && normalized.includes(candidate)) return true;
  }
  return false;
}

function isCommonPasswordCandidate(password) {
  const normalized = normalizePasswordCandidate(password);
  const leet = leetNormalize(password);
  if (!normalized) return false;
  if (BLOCKLIST.plain.has(normalized) || BLOCKLIST.plain.has(leet)) return true;
  if (BLOCKLIST.hashes.has(sha256(normalized)) || BLOCKLIST.hashes.has(sha256(leet))) return true;
  return containsCommonPasswordToken(normalized) || containsCommonPasswordToken(leet);
}

export {
  DEFAULT_BLOCKLIST_PATH,
  isCommonPasswordCandidate,
  leetNormalize,
  loadPasswordBlocklist,
  normalizePasswordCandidate
};
