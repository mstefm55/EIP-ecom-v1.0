import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const processFile = path.join(root, "services", "api", "db", "seed", "template_ecom_process.sql");
const canonicalProcessFile = path.join(root, "services", "api", "db", "seed", "template_ecom_canonical_v1.sql");
const uiFile = path.join(root, "services", "api", "db", "seed", "ui_surface_dashboard.sql");

function readFileSafe(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function collectMatches(text, regex) {
  const out = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    out.add(match[1]);
  }
  return out;
}

const processText = [readFileSafe(processFile), readFileSafe(canonicalProcessFile)].join("\n");
const uiText = readFileSafe(uiFile);

const processActions = collectMatches(processText, /"action"\s*:\s*"([^"]+)"/g);
const uiActions = collectMatches(uiText, /"((?:ORDER|RETURN|REFUND|PAYMENT)_[A-Z0-9_]+)"/g);

const missing = [...uiActions].filter((action) => !processActions.has(action));

if (missing.length > 0) {
  console.error("Process alignment failed. UI actions missing in process defs:");
  missing.sort().forEach((action) => console.error(`- ${action}`));
  process.exit(1);
}

console.log("Process alignment OK. UI actions are covered by process defs.");
