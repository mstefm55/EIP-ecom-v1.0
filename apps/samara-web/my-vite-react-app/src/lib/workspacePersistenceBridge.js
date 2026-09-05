import { perfectFitMetadata } from '../config/perfectFitMetadata';
import {
  configureRuntimeStorageRemoteBridge
} from './runtimeDataGateway';
import { ensureDefaultRuntimeRepositories } from './runtimeRepositoryBootstrap';
import {
  EIP_MEMBER_AUTH_CHANGED_EVENT,
  eipApiAdapter,
  isEipApiConfigured
} from './eipApiAdapter';

const CACHE_OWNER_KEY = 'perfectfit_workspace_cache_owner_v1';
const PENDING_WORKSPACE_KEY = 'perfectfit_workspace_remote_pending_v1';
const PENDING_OWNER_KEY = 'perfectfit_workspace_remote_pending_owner_v1';
const PERSISTENCE_EVENT = 'perfectfit:workspace-persistence';
let initialized = false;
let hydrating = false;

function workspaceStorageKey() {
  return (
    perfectFitMetadata.runtimeData?.domains?.workspace?.storageKey ||
    perfectFitMetadata.workspace?.storageKey ||
    `perfectfit_workspace_data_${perfectFitMetadata.workspace?.version || 'v1'}`
  );
}

function safeParse(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function isWorkspaceDocument(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Array.isArray(value.projects)
  );
}

function emitPersistence(detail) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(PERSISTENCE_EVENT, { detail }));
  } catch {}
}

function stagePendingWorkspace(workspace) {
  if (typeof window === 'undefined' || !isWorkspaceDocument(workspace)) return;
  window.localStorage.setItem(PENDING_WORKSPACE_KEY, JSON.stringify(workspace));
  const owner = String(window.localStorage.getItem(CACHE_OWNER_KEY) || '');
  if (owner) window.localStorage.setItem(PENDING_OWNER_KEY, owner);
}

function clearPendingWorkspace() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PENDING_WORKSPACE_KEY);
  window.localStorage.removeItem(PENDING_OWNER_KEY);
}

async function saveWorkspaceRemotely(workspace, { alreadyStaged = false } = {}) {
  if (!isWorkspaceDocument(workspace) || !isEipApiConfigured()) return null;

  if (!alreadyStaged) stagePendingWorkspace(workspace);
  emitPersistence({ state: 'saving' });

  try {
    // Runtime metadata is EIP DB authority. Browser Save sends business data only;
    // the API loads the published manifest/schema/dropdown contract server-side.
    const result = await eipApiAdapter.saveWorkspace(workspace);
    if (result?.identity_id && typeof window !== 'undefined') {
      window.localStorage.setItem(CACHE_OWNER_KEY, String(result.identity_id));
      window.localStorage.setItem(PENDING_OWNER_KEY, String(result.identity_id));
    }

    const projection = result?.enterprise_projection || null;
    const projectionWarnings = Array.isArray(projection?.products)
      ? projection.products.filter((item) => item?.ok !== true)
      : [];

    clearPendingWorkspace();
    emitPersistence({
      state: projection?.ok === false && projection?.skipped !== true
        ? 'saved_with_projection_warning'
        : 'saved',
      revision: result?.revision || 0,
      savedAt: result?.saved_at || null,
      enterpriseProjection: projection,
      manifestAudit: result?.manifest_audit || null,
      metadataSource: result?.manifest_source || null,
      fieldResolution: projection?.field_resolution?.summary || null,
      projectionWarnings
    });
    return result;
  } catch (error) {
    // Keep the pending snapshot in localStorage. The next authenticated page load
    // replays it before accepting an older remote snapshot, preventing a reload
    // immediately after Save from discarding the designer's latest work.
    emitPersistence({
      state: 'error',
      error: error?.message || String(error)
    });
    throw error;
  }
}

async function hydrateWorkspaceFromEip({
  allowLegacyMigration = false,
  reloadAfterHydrate = false
} = {}) {
  if (
    hydrating ||
    typeof window === 'undefined' ||
    !isEipApiConfigured()
  ) {
    return { hydrated: false };
  }

  hydrating = true;
  const key = workspaceStorageKey();

  try {
    const result = await eipApiAdapter.loadWorkspace();
    const identityId = String(result?.identity_id || '');
    const remoteWorkspace = result?.workspace;
    const localWorkspace = safeParse(window.localStorage.getItem(key));
    const cachedOwner = String(window.localStorage.getItem(CACHE_OWNER_KEY) || '');
    const pendingWorkspace = safeParse(
      window.localStorage.getItem(PENDING_WORKSPACE_KEY)
    );
    const pendingOwner = String(
      window.localStorage.getItem(PENDING_OWNER_KEY) || ''
    );

    if (
      isWorkspaceDocument(pendingWorkspace) &&
      (!pendingOwner || !identityId || pendingOwner === identityId)
    ) {
      const replayed = await saveWorkspaceRemotely(pendingWorkspace, {
        alreadyStaged: true
      });
      window.localStorage.setItem(key, JSON.stringify(pendingWorkspace));
      if (identityId) window.localStorage.setItem(CACHE_OWNER_KEY, identityId);
      emitPersistence({
        state: 'replayed',
        revision: replayed?.revision || 0
      });
      if (reloadAfterHydrate) window.location.reload();
      return { hydrated: true, source: 'pending-local', result: replayed };
    }

    if (pendingOwner && identityId && pendingOwner !== identityId) {
      clearPendingWorkspace();
    }

    if (isWorkspaceDocument(remoteWorkspace)) {
      window.localStorage.setItem(key, JSON.stringify(remoteWorkspace));
      if (identityId) window.localStorage.setItem(CACHE_OWNER_KEY, identityId);
      emitPersistence({
        state: 'hydrated',
        revision: result?.revision || 0,
        updatedAt: result?.updated_at || null
      });

      if (reloadAfterHydrate) {
        window.location.reload();
      }
      return { hydrated: true, source: 'eip', result };
    }

    if (cachedOwner && identityId && cachedOwner !== identityId) {
      window.localStorage.removeItem(key);
      window.localStorage.setItem(CACHE_OWNER_KEY, identityId);
      emitPersistence({ state: 'empty', source: 'eip' });
      if (reloadAfterHydrate) window.location.reload();
      return { hydrated: true, source: 'empty', result };
    }

    if (
      allowLegacyMigration &&
      isWorkspaceDocument(localWorkspace) &&
      localWorkspace.projects.length > 0
    ) {
      const saved = await saveWorkspaceRemotely(localWorkspace);
      if (identityId) window.localStorage.setItem(CACHE_OWNER_KEY, identityId);
      emitPersistence({
        state: 'migrated',
        revision: saved?.revision || 0
      });
      return { hydrated: true, source: 'legacy-local', result: saved };
    }

    if (identityId) window.localStorage.setItem(CACHE_OWNER_KEY, identityId);
    return { hydrated: true, source: 'empty', result };
  } catch (error) {
    if (error?.status !== 401) {
      console.error('[PerfectFit workspace persistence] hydrate failed', error);
      emitPersistence({
        state: 'hydrate_error',
        error: error?.message || String(error)
      });
    }
    return { hydrated: false, error };
  } finally {
    hydrating = false;
  }
}

export async function initializePerfectFitWorkspacePersistence() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  // This installs the metadata-driven storage-key -> domain mapping before
  // the Workspace component performs its first synchronous read.
  ensureDefaultRuntimeRepositories();

  await hydrateWorkspaceFromEip({ allowLegacyMigration: true });

  configureRuntimeStorageRemoteBridge(async ({ operation, key, domain, value }) => {
    if (domain !== 'workspace' || key !== workspaceStorageKey()) return;
    if (operation !== 'setItem') return;

    const workspace = safeParse(value);
    if (!isWorkspaceDocument(workspace)) return;
    await saveWorkspaceRemotely(workspace);
  });

  window.addEventListener(EIP_MEMBER_AUTH_CHANGED_EVENT, (event) => {
    const authenticated = event?.detail?.authenticated === true;
    if (!authenticated) {
      window.localStorage.removeItem(workspaceStorageKey());
      window.localStorage.removeItem(CACHE_OWNER_KEY);
      clearPendingWorkspace();
      emitPersistence({ state: 'signed_out' });
      return;
    }

    hydrateWorkspaceFromEip({
      allowLegacyMigration: false,
      reloadAfterHydrate: true
    }).catch(() => {});
  });
}

export { PERSISTENCE_EVENT as PERFECT_FIT_WORKSPACE_PERSISTENCE_EVENT };
