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
// v2 deliberately forces one fresh governed save for workspaces already processed by
// the earlier commerce-profile reconciliation. That fresh save now also bridges any
// legacy PF publication state into the existing EIP publication process authority.
const COMMERCE_RECONCILE_MARKER_KEY = 'perfectfit_workspace_commerce_profile_reconciled_v2';
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

function normalizePublicationStatus(value) {
  return String(value || '').trim().toUpperCase();
}

function publicationRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.requests)) return payload.requests;
  if (Array.isArray(payload?.publication_requests)) return payload.publication_requests;
  return [];
}

function publicationRequestId(row) {
  return String(
    row?.request_id ||
    row?.requestId ||
    row?.id ||
    ''
  ).trim();
}

function publicationStatus(row) {
  return normalizePublicationStatus(
    row?.status ||
    row?.publication_status ||
    row?.publicationStatus
  );
}

function collectWorkspacePublicationIntents(workspace) {
  const intents = [];

  for (const project of Array.isArray(workspace?.projects) ? workspace.projects : []) {
    if (project?.nodeType !== 'project') continue;

    for (const style of Array.isArray(project?.children) ? project.children : []) {
      if (style?.nodeType !== 'product') continue;

      for (const variant of Array.isArray(style?.children) ? style.children : []) {
        if (variant?.nodeType !== 'variant') continue;

        const release = variant?.values?.publicationRelease;
        const requestId = String(release?.requestId || '').trim();
        const status = normalizePublicationStatus(release?.status);
        if (!requestId || !status) continue;

        if (![
          'AWAITING_MODERATOR_RELEASE',
          'PUBLISHED',
          'RETURNED_BY_MODERATOR'
        ].includes(status)) {
          continue;
        }

        const variantCode = String(variant?.values?.['variant.code'] || '').trim();
        const styleName = String(
          style?.values?.['product.style_name'] ||
          style?.title ||
          'Product'
        ).trim();
        const variantName = String(
          variant?.values?.['variant.name'] ||
          variant?.title ||
          'Variant'
        ).trim();

        // Only the customer-facing identity projection is sent to publication intake.
        // The private Workspace payload remains server-side and is never exposed to PF Admin.
        const pattern = {
          name: styleName,
          styleName,
          styleCode: String(style?.values?.['product.style_code'] || '').trim(),
          variantName,
          variantCode,
          workspaceVariantId: String(variant.id || ''),
          variantId: String(variant.id || ''),
          eipProductId: variant?.integration?.eip?.productId || null
        };

        intents.push({
          requestId,
          variantId: String(variant.id || ''),
          variantCode,
          status,
          moderatorNote: String(release?.moderatorNote || '').trim(),
          pattern
        });
      }
    }
  }

  return intents;
}

async function reconcileWorkspacePublicationAuthority(workspace) {
  const intents = collectWorkspacePublicationIntents(workspace);
  if (!intents.length) {
    return {
      ok: true,
      skipped: true,
      submitted: 0,
      published: 0,
      returned: 0,
      warnings: []
    };
  }

  const warnings = [];
  let submitted = 0;
  let published = 0;
  let returned = 0;
  let existingRows = [];

  try {
    const mine = await eipApiAdapter.listMyPublicationRequests();
    existingRows = publicationRows(mine);
  } catch (error) {
    warnings.push({
      request_id: null,
      action: 'LIST_MINE',
      error: error?.code || error?.message || String(error)
    });
  }

  const byRequestId = new Map(
    existingRows
      .map((row) => [publicationRequestId(row), row])
      .filter(([requestId]) => Boolean(requestId))
  );

  for (const intent of intents) {
    let serverRow = byRequestId.get(intent.requestId) || null;

    if (!serverRow) {
      try {
        const created = await eipApiAdapter.submitPublicationRequest({
          request_id: intent.requestId,
          variant_id: intent.variantId,
          variant_code: intent.variantCode,
          pattern: intent.pattern
        });
        submitted += 1;
        serverRow = created?.item || created?.request || created?.publication_request || created || null;
        if (serverRow) byRequestId.set(intent.requestId, serverRow);
      } catch (error) {
        warnings.push({
          request_id: intent.requestId,
          action: 'SUBMIT',
          error: error?.code || error?.message || String(error)
        });
        continue;
      }
    }

    const serverStatus = publicationStatus(serverRow);

    if (intent.status === 'PUBLISHED' && serverStatus !== 'PUBLISHED') {
      try {
        await eipApiAdapter.moderatePublicationRequest(
          intent.requestId,
          'PUBLISH'
        );
        published += 1;
      } catch (error) {
        warnings.push({
          request_id: intent.requestId,
          action: 'PUBLISH',
          error: error?.code || error?.message || String(error)
        });
      }
      continue;
    }

    if (
      intent.status === 'RETURNED_BY_MODERATOR' &&
      serverStatus !== 'RETURNED_BY_MODERATOR' &&
      intent.moderatorNote
    ) {
      try {
        await eipApiAdapter.moderatePublicationRequest(
          intent.requestId,
          'RETURN',
          intent.moderatorNote
        );
        returned += 1;
      } catch (error) {
        warnings.push({
          request_id: intent.requestId,
          action: 'RETURN',
          error: error?.code || error?.message || String(error)
        });
      }
    }
  }

  return {
    ok: warnings.length === 0,
    skipped: false,
    submitted,
    published,
    returned,
    warnings
  };
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

    // Publication is a separate governed EIP process. Older PF builds only updated
    // the private workspace presentation state, which is why PF Admin could display
    // "Published" while Commerce correctly rejected the material. Bridge that intent
    // into the existing server publication routes after the private save succeeds.
    // Failures remain warnings: publication must never destroy a successful private save.
    let publicationAuthority = {
      ok: true,
      skipped: true,
      submitted: 0,
      published: 0,
      returned: 0,
      warnings: []
    };
    try {
      publicationAuthority = await reconcileWorkspacePublicationAuthority(
        persistedWorkspace
      );
    } catch (error) {
      publicationAuthority = {
        ok: false,
        skipped: false,
        submitted: 0,
        published: 0,
        returned: 0,
        warnings: [{
          request_id: null,
          action: 'RECONCILE',
          error: error?.code || error?.message || String(error)
        }]
      };
    }

    const projectionWarnings = Array.isArray(projection?.products)
      ? projection.products.filter((item) => item?.ok !== true)
      : [];

    clearPendingWorkspace();
    if (result?.identity_id) {
      markProjectionReconciled(result.identity_id, result?.revision || 0);
      markCommerceReconciled(result.identity_id, result?.revision || 0);
    }
    emitPersistence({
      state: publicationAuthority.ok === false
        ? 'saved_with_publication_warning'
        : projection?.ok === false && projection?.skipped !== true
        ? 'saved_with_projection_warning'
        : 'saved',
      revision: result?.revision || 0,
      savedAt: result?.saved_at || null,
      enterpriseProjection: projection,
      publicationAuthority,
      manifestAudit: result?.manifest_audit || null,
      metadataSource: result?.manifest_source || null,
      fieldResolution: projection?.field_resolution?.summary || null,
      projectionWarnings,
      reconciledProductIdentityCount: identityReconciliation.linkedCount
    });
    return {
      ...(result || {}),
      workspace: persistedWorkspace,
      publication_authority: publicationAuthority
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

      // Re-run the governed enterprise projection once for older already-linked
      // workspaces, and at the same time bridge any legacy publication state into the
      // existing EIP publication process. The versioned marker prevents reload loops.
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
