import { perfectFitMetadata } from '../config/perfectFitMetadata';

export const FLOATING_TOOL_LAYOUT_VERSION = perfectFitMetadata.app.floatingTools.version;
export const FLOATING_TOOL_LAUNCHER = perfectFitMetadata.app.floatingTools.launcher;
const STACK_INDEX_BY_TOOL = perfectFitMetadata.app.floatingTools.stackIndexByTool || {};

const finiteNumber = (value) => Number.isFinite(Number(value));

export function getDefaultFloatingToolPosition(toolId = 'messages') {
  if (typeof window === 'undefined') {
    return {
      x: 16,
      y: 16
    };
  }

  const index = STACK_INDEX_BY_TOOL[toolId] ?? 0;
  const { width, height, edge, gap } = FLOATING_TOOL_LAUNCHER;

  return {
    x: Math.max(edge, window.innerWidth - width - edge),
    y: Math.max(
      edge,
      window.innerHeight - height - edge - index * (height + gap)
    )
  };
}

export function clampFloatingToolPosition(position, width = FLOATING_TOOL_LAUNCHER.width) {
  if (typeof window === 'undefined') return position;

  const { edge, height } = FLOATING_TOOL_LAUNCHER;

  return {
    x: Math.max(edge, Math.min(Number(position?.x) || edge, window.innerWidth - width - edge)),
    y: Math.max(edge, Math.min(Number(position?.y) || edge, window.innerHeight - height - edge))
  };
}

export function normalizeFloatingToolLayout(storageKey, toolId, fallbackCompact = false) {
  let saved = null;

  if (typeof window !== 'undefined' && storageKey) {
    try {
      const raw = window.localStorage?.getItem(storageKey);
      saved = raw ? JSON.parse(raw) : null;
    } catch {
      saved = null;
    }
  }

  if (
    saved?.layoutVersion === FLOATING_TOOL_LAYOUT_VERSION &&
    finiteNumber(saved.x) &&
    finiteNumber(saved.y)
  ) {
    const compact = typeof saved.compact === 'boolean' ? saved.compact : fallbackCompact;
    const width = compact
      ? FLOATING_TOOL_LAUNCHER.compactWidth
      : FLOATING_TOOL_LAUNCHER.width;

    return {
      x: Number(saved.x),
      y: Number(saved.y),
      compact,
      layoutVersion: FLOATING_TOOL_LAYOUT_VERSION,
      ...clampFloatingToolPosition(saved, width)
    };
  }

  return {
    ...getDefaultFloatingToolPosition(toolId),
    compact: false,
    layoutVersion: FLOATING_TOOL_LAYOUT_VERSION
  };
}

export function persistFloatingToolLayout(storageKey, layout) {
  if (typeof window === 'undefined' || !storageKey) return;

  try {
    window.localStorage?.setItem(
      storageKey,
      JSON.stringify({
        layoutVersion: FLOATING_TOOL_LAYOUT_VERSION,
        x: Number(layout?.x) || 0,
        y: Number(layout?.y) || 0,
        compact: Boolean(layout?.compact)
      })
    );
  } catch {}
}
