import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UNSAFE_ROOTS = new Set(['', '/', '/app', '/data']);

function normalizeText(value) {
  return String(value ?? '').trim();
}

function decodeMountPath(value) {
  return String(value || '')
    .replace(/\\040/g, ' ')
    .replace(/\\011/g, '\t')
    .replace(/\\012/g, '\n')
    .replace(/\\134/g, '\\');
}

function normalizeAbsoluteAssetRoot(assetRoot, hasDataDir) {
  const configured = normalizeText(assetRoot);
  if (!configured) {
    return hasDataDir ? '/data/eip-assets' : '/app/assets';
  }
  if (configured.startsWith('/')) {
    return path.posix.normalize(configured);
  }
  return path.posix.normalize(`/app/${configured}`);
}

function targetIsWithinMount(target, mountPoint) {
  if (!mountPoint || mountPoint === '/') return false;
  return target === mountPoint || target.startsWith(`${mountPoint.replace(/\/$/, '')}/`);
}

export function listNonRootMountPoints(mountInfo = '') {
  return String(mountInfo || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/)[4])
    .filter(Boolean)
    .map(decodeMountPath)
    .filter((mountPoint) => mountPoint !== '/');
}

export function isBackedByPersistentMount(assetRoot, mountInfo = '') {
  const target = path.posix.normalize(String(assetRoot || ''));
  return listNonRootMountPoints(mountInfo).some((mountPoint) =>
    targetIsWithinMount(target, path.posix.normalize(mountPoint))
  );
}

export function resolveAssetStorage({
  assetRoot = '',
  nodeEnv = '',
  hasDataDir = false,
  mountInfo = ''
} = {}) {
  const resolvedRoot = normalizeAbsoluteAssetRoot(assetRoot, hasDataDir);

  if (UNSAFE_ROOTS.has(resolvedRoot)) {
    throw new Error(`Invalid upload root: ${resolvedRoot || '<empty>'}`);
  }

  if (normalizeText(nodeEnv).toLowerCase() === 'production') {
    if (!isBackedByPersistentMount(resolvedRoot, mountInfo)) {
      throw new Error(
        `Production asset storage must be backed by a mounted persistent volume: ${resolvedRoot}`
      );
    }
  }

  return resolvedRoot;
}

function readMountInfo() {
  try {
    return fs.readFileSync('/proc/self/mountinfo', 'utf8');
  } catch {
    return '';
  }
}

function runCli() {
  try {
    const resolvedRoot = resolveAssetStorage({
      assetRoot: process.env.ASSET_ROOT,
      nodeEnv: process.env.NODE_ENV,
      hasDataDir: fs.existsSync('/data'),
      mountInfo: readMountInfo()
    });
    process.stdout.write(`${resolvedRoot}\n`);
  } catch (error) {
    process.stderr.write(`${error?.message || error}\n`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  runCli();
}
