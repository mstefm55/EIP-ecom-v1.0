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
import { productIntegrationService } from './productIntegrationService';

const CACHE_OWNER_KEY = 'perfectfit_workspace_cache_owner_v1';
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

function collectLinkedVariants(workspace) {
  const linked = [];

  for (const project of workspace?.projects || []) {
    if (project?.nodeType !== 'project') continue;
    for (const style of project.children || []) {
      if (style?.nodeType !== 'product') continue;
      for (const variant of style.children || []) {
        if (variant?.nodeType !== 'variant') continue;
        const productId = variant?.integration?.eip?.productId;
        if (!productId) continue;
        linked.push({ productId, project, style, variant });
      }
    }
  }

  return linked;
}

async function syncLinkedEnterpriseProducts(workspace) {
  const results = [];
  for (const item of collectLinkedVariants(workspace)) {
    try {
      const result = await productIntegrationService.sync(item.productId, item);
      results.push({
        productId: item.productId,
        ok: true,
        conflicts: result?.conflicts || []
      });
    } catch (error) {
      results.push({
        productId: item.productId,
        ok: false,
        error: error?.message || String(error)
      });
    }
  }
  return results;
}

async function saveWorkspaceRemotely(workspace) {
  if (!isWorkspaceDocument(workspace) || !isEipApiConfigured()) return null;

  emitPersistence({ state: 'saving' });
  try {
    const result = await eipApiAdapter.saveWorkspace(workspace);
    if (result?.identity_id && typeof window !== 'undefined') {
      window.localStorage.setItem(CACHE_OWNER_KEY, String(result.identity_id));
    }

    const enterpriseSync = await syncLinkedEnterpriseProducts(workspace);
    const failedSyncs = enterpriseSync.filter((item) => !item.ok);
    const conflicts = enterpriseSync.flatMap((item) => item.conflicts || []);

    emitPersistence({
      state: failedSyncs.length ? 'saved_with_sync_warning' : 'saved',
      revision: result?.revision || 0,
      savedAt: result?.saved_at || null,
      failedSyncs,
      conflicts
    });
    return result;
  } catch (error) {
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

  // This also installs the metadata-driven storage-key -> domain mapping before
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
