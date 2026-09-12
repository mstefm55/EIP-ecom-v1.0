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
import {
  applyEnterpriseProjectionProductIds,
  workspaceNeedsProjectionIdentityReconciliation
} from './workspaceProjectionIdentity';

const CACHE_OWNER_KEY = 'perfectfit_workspace_cache_owner_v1';
const PENDING_WORKSPACE_KEY = 'perfectfit_workspace_remote_pending_v1';
const PENDING_OWNER_KEY = 'perfectfit_workspace_remote_pending_owner_v1';
const PROJECTION_RECONCILE_MARKER_KEY = 'perfectfit_workspace_projection_identity_reconciled_v1';
const COMMERCE_RECONCILE_MARKER_KEY = 'perfectfit_workspace_commerce_profile_reconciled_v1';
const WORKSPACE_PRESENTATION_REFRESH_EVENT = 'perfectfit_workspace_product_presentation_updated';
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

function publishWorkspaceCache(workspace) {
  if (typeof window === 'undefined' || !isWorkspaceDocument(workspace)) return;
  window.localStorage.setItem(workspaceStorageKey(), JSON.stringify(workspace));
  try {
    window.dispatchEvent(new CustomEvent(WORKSPACE_PRESENTATION_REFRESH_EVENT));
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

function reconciliationMarker(storageKey) {
  if (typeof window === 'undefined') return null;
  return safeParse(window.localStorage.getItem(storageKey));
}

function reconciliationAttempted(storageKey, identityId, revision) {
  const marker = reconciliationMarker(storageKey);
  return Boolean(
    marker &&
    String(marker.identityId || '') === String(identityId || '') &&
    Number(marker.revision || 0) === Number(revision || 0)
  );
}

function markReconciled(storageKey, identityId, revision) {
  if (typeof window === 'undefined' || !identityId) return;
  window.localStorage.setItem(
    storageKey,
    JSON.stringify({
      identityId: String(identityId),
      revision: Number(revision || 0)
    })
  );
}

function projectionReconcileAttempted(identityId, revision) {
  return reconciliationAttempted(
    PROJECTION_RECONCILE_MARKER_KEY,
    identityId,
    revision
  );
}

function markProjectionReconciled(identityId, revision) {
  markReconciled(PROJECTION_RECONCILE_MARKER_KEY, identityId, revision);
}

function commerceReconcileAttempted(identityId, revision) {
  return reconciliationAttempted(
    COMMERCE_RECONCILE_MARKER_KEY,
    identityId,
    revision
  );
}

function markCommerceReconciled(identityId, revision) {
  markReconciled(COMMERCE_RECONCILE_MARKER_KEY, identityId, revision);
}

async function saveWorkspaceRemotely(workspace, { alreadyStaged = false } = {}) {
  if (!isWorkspaceDocument(workspace) || !isEipApiConfigured()) return null;

  if (!alreadyStaged) stagePendingWorkspace(workspace);
  emitPersistence({ state: 'saving' });

  try {
    // Runtime metadata is EIP DB authority. Browser Save sends business data only;
    // the API loads the published manifest/schema/dropdown contract server-side.
    let result = await eipApiAdapter.saveWorkspace(workspace);
    if (result?.identity_id && typeof window !== 'undefined') {
      window.localStorage.setItem(CACHE_OWNER_KEY, String(result.identity_id));
      window.localStorage.setItem(PENDING_OWNER_KEY, String(result.identity_id));
    }

    let persistedWorkspace = workspace;
    let projection = result?.enterprise_projection || null;
    const identityReconciliation = applyEnterpriseProjectionProductIds(
      workspace,
      projection,
      { syncedAt: result?.saved_at || null }
    );

    // Automatic EIP projection already owns the PF -> material relationship. Persist
    // the returned material UUID back into the private workspace snapshot so checkout
    // uses the governed material identity instead of local style/variant references.
    if (identityReconciliation.changed) {
      persistedWorkspace = identityReconciliation.workspace;
      stagePendingWorkspace(persistedWorkspace);

      const reconciledResult = await eipApiAdapter.saveWorkspace(persistedWorkspace);
      if (reconciledResult?.identity_id && typeof window !== 'undefined') {
        window.localStorage.setItem(CACHE_OWNER_KEY, String(reconciledResult.identity_id));
        window.localStorage.setItem(PENDING_OWNER_KEY, String(reconciledResult.identity_id));
      }
      result = reconciledResult || result;
      projection = result?.enterprise_projection || projection;
      publishWorkspaceCache(persistedWorkspace);
    }

    const projectionWarnings = Array.isArray(projection?.products)
      ? projection.products.filter((item) => item?.ok !== true)
      : [];

    clearPendingWorkspace();
    if (result?.identity_id) {
      markProjectionReconciled(result.identity_id, result?.revision || 0);
      // Any successful governed workspace save re-runs enterprise product projection.
      // Round-2 server projection therefore also repairs the legacy PF commerce profile
      // (digital delivery, inventory tracking, and publication stage) for this revision.
      markCommerceReconciled(result.identity_id, result?.revision || 0);
    }
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
      projectionWarnings,
      reconciledProductIdentityCount: identityReconciliation.linkedCount
    });
    return {
      ...(result || {}),
      workspace: persistedWorkspace
    };
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
      const replayedWorkspace = isWorkspaceDocument(replayed?.workspace)
        ? replayed.workspace
        : pendingWorkspace;
      publishWorkspaceCache(replayedWorkspace);
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
      let hydratedWorkspace = remoteWorkspace;
      let hydratedResult = result;
      const remoteRevision = Number(result?.revision || 0);

      // Older workspace snapshots predate automatic persistence of the material UUID
      // returned by enterprise projection. Re-run that governed projection once for
      // this remote revision, then keep the reconciled snapshot as the new EIP source.
      if (
        identityId &&
        workspaceNeedsProjectionIdentityReconciliation(remoteWorkspace) &&
        !projectionReconcileAttempted(identityId, remoteRevision)
      ) {
        try {
          const reconciled = await saveWorkspaceRemotely(remoteWorkspace);
          if (isWorkspaceDocument(reconciled?.workspace)) {
            hydratedWorkspace = reconciled.workspace;
          }
          hydratedResult = reconciled || result;
          markProjectionReconciled(
            identityId,
            reconciled?.revision || remoteRevision
          );
        } catch (error) {
          // The private remote snapshot is still valid even when reconciliation fails.
          // Keep the pending outbox for retry, but do not discard or block hydration.
          markProjectionReconciled(identityId, remoteRevision);
          emitPersistence({
            state: 'projection_identity_reconcile_warning',
            revision: remoteRevision,
            error: error?.message || String(error)
          });
        }
      }

      // Round 2 also needs one governed projection pass for older workspaces that
      // already contain EIP material UUIDs. That pass repairs only PF-linked material
      // commerce attributes server-side and leaves the private workspace payload intact.
      const commerceRevision = Number(hydratedResult?.revision || remoteRevision);
      if (
        identityId &&
        !commerceReconcileAttempted(identityId, commerceRevision)
      ) {
        try {
          const reconciled = await saveWorkspaceRemotely(hydratedWorkspace);
          if (isWorkspaceDocument(reconciled?.workspace)) {
            hydratedWorkspace = reconciled.workspace;
          }
          hydratedResult = reconciled || hydratedResult;
          markCommerceReconciled(
            identityId,
            reconciled?.revision || commerceRevision
          );
        } catch (error) {
          // saveWorkspaceRemotely retains the pending outbox, so a later authenticated
          // page load can replay the same snapshot without losing designer data.
          markCommerceReconciled(identityId, commerceRevision);
          emitPersistence({
            state: 'commerce_profile_reconcile_warning',
            revision: commerceRevision,
            error: error?.message || String(error)
          });
        }
      }

      publishWorkspaceCache(hydratedWorkspace);
      if (identityId) window.localStorage.setItem(CACHE_OWNER_KEY, identityId);
      emitPersistence({
        state: 'hydrated',
        revision: hydratedResult?.revision || remoteRevision,
        updatedAt: hydratedResult?.updated_at || result?.updated_at || null
      });

      if (reloadAfterHydrate) {
        window.location.reload();
      }
      return { hydrated: true, source: 'eip', result: hydratedResult };
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
      const migratedWorkspace = isWorkspaceDocument(saved?.workspace)
        ? saved.workspace
        : localWorkspace;
      publishWorkspaceCache(migratedWorkspace);
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
      window.localStorage.removeItem(PROJECTION_RECONCILE_MARKER_KEY);
      window.localStorage.removeItem(COMMERCE_RECONCILE_MARKER_KEY);
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
