import { perfectFitMetadata } from './perfectFitMetadata';

export const SURFACE_VISIBILITY_VERSION = perfectFitMetadata.app.surfaces.version;
export const SURFACE_VISIBILITY_STORAGE_KEY = perfectFitMetadata.app.storage.surfaceVisibility;
export const SURFACE_VISIBILITY_REGISTRY = perfectFitMetadata.app.surfaces.registry;

const DEFAULT_HIDDEN_IDS = new Set(perfectFitMetadata.app.surfaces.defaultHiddenIds || []);
const WORKSPACE_NODE_SURFACE_IDS = perfectFitMetadata.app.surfaces.workspaceNodeSurfaceIds || {};

export function getDefaultSurfaceVisibilityState() {
  return JSON.parse(JSON.stringify(perfectFitMetadata.app.surfaces.defaultState));
}

export function loadSurfaceVisibilityState() {
  const defaults = getDefaultSurfaceVisibilityState();

  if (typeof window === 'undefined') return defaults;

  try {
    const raw = window.localStorage?.getItem(SURFACE_VISIBILITY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    if (!parsed || parsed.version !== SURFACE_VISIBILITY_VERSION) {
      return defaults;
    }

    return {
      version: SURFACE_VISIBILITY_VERSION,
      enabledById: {
        ...defaults.enabledById,
        ...(parsed.enabledById || {}),
        'role-based-dynamic-layout': false,
        'perfectfit-specification': false
      }
    };
  } catch {
    return defaults;
  }
}

export function persistSurfaceVisibilityState(state) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage?.setItem(
      SURFACE_VISIBILITY_STORAGE_KEY,
      JSON.stringify({
        version: SURFACE_VISIBILITY_VERSION,
        enabledById: state?.enabledById || {}
      })
    );
  } catch {}
}

export function isSurfaceVisible(state, surfaceId) {
  const surface = SURFACE_VISIBILITY_REGISTRY.find((item) => item.id === surfaceId);
  if (surface?.lockedDisabled) return false;

  return state?.enabledById?.[surfaceId] !== false;
}

export function setSurfaceVisibility(state, surfaceId, enabled) {
  const surface = SURFACE_VISIBILITY_REGISTRY.find((item) => item.id === surfaceId);
  if (surface?.lockedDisabled) {
    enabled = false;
  }

  return {
    version: SURFACE_VISIBILITY_VERSION,
    enabledById: {
      ...(state?.enabledById || {}),
      [surfaceId]: Boolean(enabled)
    }
  };
}

export function getWorkspaceSurfaceIdForNode(nodeType) {
  return WORKSPACE_NODE_SURFACE_IDS[nodeType] || null;
}

export function isWorkspaceNodeVisible(state, nodeType) {
  const surfaceId = getWorkspaceSurfaceIdForNode(nodeType);
  return surfaceId ? isSurfaceVisible(state, surfaceId) : true;
}
