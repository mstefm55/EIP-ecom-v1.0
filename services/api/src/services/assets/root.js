import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ASSET_ROOT = path.resolve(__dirname, "../../../assets");

function resolveAssetRoot(config = {}) {
  const configured = String(config?.ASSET_ROOT || "").trim();
  return path.resolve(configured || DEFAULT_ASSET_ROOT);
}

export {
  DEFAULT_ASSET_ROOT,
  resolveAssetRoot
};
