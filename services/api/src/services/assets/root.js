import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ASSET_ROOT = path.resolve(__dirname, "../../../assets");
const DEFAULT_RAILWAY_VOLUME_ROOT = path.resolve("/data/eip-assets");

const STORAGE_ERROR_CODES = Object.freeze({
  DIRECTORY_NOT_FOUND: "UPLOAD_DIRECTORY_NOT_FOUND",
  WRITE_FAILED: "UPLOAD_WRITE_FAILED",
  NOT_WRITABLE: "STORAGE_NOT_WRITABLE"
});

class UploadStorageError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "UploadStorageError";
    this.code = code;
  }
}

function isRailwayRuntime(config = {}) {
  return Boolean(
    config?.RAILWAY_ENVIRONMENT_ID ||
    config?.RAILWAY_PROJECT_ID ||
    config?.RAILWAY_SERVICE_ID ||
    process.env.RAILWAY_ENVIRONMENT_ID ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.RAILWAY_SERVICE_ID
  );
}

function configuredRailwayMount(config = {}) {
  return String(
    config?.RAILWAY_VOLUME_MOUNT_PATH || process.env.RAILWAY_VOLUME_MOUNT_PATH || ""
  ).trim();
}

function resolveAssetRoot(config = {}) {
  const configured = String(config?.ASSET_ROOT || "").trim();
  if (configured) return path.resolve(configured);

  const railwayMount = configuredRailwayMount(config);
  if (railwayMount) return path.resolve(railwayMount, "eip-assets");

  if (isRailwayRuntime(config) && fs.existsSync(path.dirname(DEFAULT_RAILWAY_VOLUME_ROOT))) {
    return DEFAULT_RAILWAY_VOLUME_ROOT;
  }

  return DEFAULT_ASSET_ROOT;
}

function resolveStorageMode(config = {}) {
  if (String(config?.ASSET_ROOT || "").trim()) return "configured_filesystem";
  if (configuredRailwayMount(config)) return "railway_volume";
  if (isRailwayRuntime(config) && fs.existsSync(path.dirname(DEFAULT_RAILWAY_VOLUME_ROOT))) {
    return "railway_volume";
  }
  return "local_filesystem";
}

function classifyStorageError(error) {
  if (error instanceof UploadStorageError) return error;
  const code = String(error?.code || "").toUpperCase();
  if (["EACCES", "EPERM", "EROFS"].includes(code)) {
    return new UploadStorageError(
      STORAGE_ERROR_CODES.NOT_WRITABLE,
      "Upload storage is not writable.",
      error
    );
  }
  if (["ENOENT", "ENOTDIR"].includes(code)) {
    return new UploadStorageError(
      STORAGE_ERROR_CODES.DIRECTORY_NOT_FOUND,
      "Upload storage directory is unavailable.",
      error
    );
  }
  return new UploadStorageError(
    STORAGE_ERROR_CODES.WRITE_FAILED,
    "Upload storage operation failed.",
    error
  );
}

function assertPathInsideRoot(rootDir, targetDir) {
  const root = path.resolve(rootDir);
  const target = path.resolve(targetDir);
  if (target === root) return target;
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (!target.startsWith(rootWithSep)) {
    throw new UploadStorageError(
      STORAGE_ERROR_CODES.WRITE_FAILED,
      "Upload storage path escaped its configured root."
    );
  }
  return target;
}

function ensureUploadDirectory(rootDir, segments = [], fileSystem = fs) {
  const root = path.resolve(rootDir);
  const target = assertPathInsideRoot(root, path.resolve(root, ...segments));
  try {
    fileSystem.mkdirSync(target, { recursive: true });
    fileSystem.accessSync(target, fs.constants.W_OK);
    return target;
  } catch (error) {
    throw classifyStorageError(error);
  }
}

function inspectUploadStorage(config = {}) {
  const uploadRoot = resolveAssetRoot(config);
  const storageMode = resolveStorageMode(config);
  let directoryExists = false;
  let writable = false;
  let error = null;
  let probePath = null;

  try {
    fs.mkdirSync(uploadRoot, { recursive: true });
    directoryExists = fs.existsSync(uploadRoot) && fs.statSync(uploadRoot).isDirectory();
    if (!directoryExists) {
      throw Object.assign(new Error("Upload root is not a directory."), { code: "ENOTDIR" });
    }
    probePath = path.join(uploadRoot, `.eip-write-probe-${process.pid}-${Date.now()}`);
    fs.writeFileSync(probePath, "ok", { flag: "wx" });
    writable = true;
  } catch (cause) {
    error = classifyStorageError(cause);
  } finally {
    if (probePath) {
      try {
        fs.rmSync(probePath, { force: true });
      } catch {
        // The diagnostic must not mask the original storage result.
      }
    }
  }

  return {
    uploadRoot,
    directoryExists,
    writable,
    storageMode,
    error
  };
}

export {
  DEFAULT_ASSET_ROOT,
  DEFAULT_RAILWAY_VOLUME_ROOT,
  STORAGE_ERROR_CODES,
  UploadStorageError,
  classifyStorageError,
  ensureUploadDirectory,
  inspectUploadStorage,
  resolveAssetRoot,
  resolveStorageMode
};
