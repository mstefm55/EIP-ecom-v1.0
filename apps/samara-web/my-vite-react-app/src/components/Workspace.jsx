import React, { useEffect, useMemo, useRef, useState } from 'react';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderTree,
  Layers3,
  Shirt,
  GitBranch,
  FileStack,
  Ruler,
  Scissors,
  Images,
  FileText,
  History,
  Circle,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Save,
  Loader2,
  Search,
  X,
  Upload,
  Download,
  RotateCw,
  Check,
  AlertTriangle,
  Image as ImageIcon,
  Database,
  Share2,
  Users,
  ShieldCheck,
  Minus,
  Maximize2,
  Minimize2,
  ExternalLink
} from 'lucide-react';

import { perfectFitMetadata } from '../config/perfectFitMetadata';
import WorkspaceApprovalCenter from './workspace/WorkspaceApprovalCenter';
import WorkspaceMessagingWidget from './workspace/WorkspaceMessagingWidget';
import ProductIntegrationMenu from './ProductIntegrationMenu';
import { loadMediaFile } from './workspace/WorkspaceMedia';
import TechPackWorkspace from './workspace/TechPackWorkspace';
import { ProjectJournalModule as ProjectJournalModuleView } from './workspace/ProjectJournal';
import TimeAndMotionStudy from './subcomponents/TimeAndMotionStudy';
import IndustrialTechPack from './IndustrialTechPack';
import { WORKSPACE_PRESENTATION_UPDATED_EVENT } from '../lib/workspaceProductPresentation';
import { buildWorkspaceFitSpecificationSnapshot } from '../lib/fitRecommendation';
import { isWorkspaceNodeVisible } from '../config/surfaceVisibilityMetadata';
import { UI_LAYERS } from '../lib/uiLayers';
import { runtimeDataStorage } from '../lib/runtimeDataGateway';
import { clientPreferences } from '../lib/clientPreferences';
import { createIndexedDbRecordStore } from '../lib/clientBinaryCache';
import {
  createDefaultMeasurementChartValues,
  createMeasurementChartRevision,
  convertMeasurementChartUnitValues,
  getCustomerSizeSystems,
  getDisplaySizeReferences,
  getFitBodyAreaLabel,
  getMeasurementSizeSystems,
  getPreferredSizeReference,
  normalizeMeasurementChartValues,
  resolveBaseSizeReference
} from '../lib/measurementChart';
import {
  generatePatternFileReference,
  generateProjectReference,
  generateStyleReference,
  generateVariantReference
} from '../lib/workspaceReferences';
import {
  applyEipSharedPatch,
  buildEipStarterInput
} from '../lib/productIntegrationService';

const ICON_REGISTRY = {
  project: Folder,
  product: Shirt,
  variant: GitBranch,
  projectJournal: FileText,
  media: Images,
  patternLibrary: FileStack,
  sizeSet: Ruler,
  sewing: Scissors,
  techpack: FileText,
  changeHistory: History,
  default: Layers3
};
const workspaceMetadata = perfectFitMetadata.workspace;

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function resolveWorkspaceActor(currentUser) {
  const user = currentUser || {};

  const id =
    user.id ||
    user.identity_id ||
    user.identityId ||
    user.userId ||
    user.sub ||
    'local-user';

  const email =
    user.email ||
    user.login ||
    user.username ||
    '';

  const name =
    user.name ||
    user.display_name ||
    user.displayName ||
    user.fullName ||
    user.username ||
    email ||
    'Workspace user';

  return {
    id: String(id),
    name: String(name),
    login: String(user.login || user.username || email || name),
    username: String(user.username || user.login || ''),
    brandName: String(user.brandName || user.designerBrand || user.studioName || ''),
    email: String(email),
    accessType: String(
      user.accessType ||
      user.access_type ||
      user.role ||
      ''
    )
  };
}

function flattenAuditValue(value, path = '', output = {}) {
  if (
    value === null ||
    value === undefined ||
    typeof value !== 'object'
  ) {
    output[path || 'value'] = value ?? null;
    return output;
  }

  if (Array.isArray(value)) {
    const idAddressable =
      value.length > 0 &&
      value.every(
        (item) =>
          item &&
          typeof item === 'object' &&
          !Array.isArray(item) &&
          item.id
      );

    if (!idAddressable) {
      output[path || 'value'] = cloneValue(value);
      return output;
    }

    value.forEach((item) => {
      const nextPath =
        `${path}[${item.id}]`;

      flattenAuditValue(
        item,
        nextPath,
        output
      );
    });

    return output;
  }

  const entries =
    Object.entries(value);

  if (!entries.length) {
    output[path || 'value'] = {};
    return output;
  }

  entries.forEach(([key, childValue]) => {
    const nextPath =
      path
        ? `${path}.${key}`
        : key;

    flattenAuditValue(
      childValue,
      nextPath,
      output
    );
  });

  return output;
}

function flattenWorkspaceForAudit(nodes = [], context = {}) {
  const result = new Map();

  nodes.forEach((node) => {
    const nextContext = {
      ...context
    };

    if (node.nodeType === 'project') {
      nextContext.projectId = node.id;
      nextContext.styleId = null;
      nextContext.variantId = null;
    }

    if (node.nodeType === 'product') {
      nextContext.styleId = node.id;
      nextContext.variantId = null;
    }

    if (node.nodeType === 'variant') {
      nextContext.variantId = node.id;
    }

    if (node.nodeType !== 'changeHistory') {
      result.set(node.id, {
        node,
        context: nextContext,
        flatValues:
          flattenAuditValue(
            node.values || {}
          )
      });
    }

    flattenWorkspaceForAudit(
      node.children || [],
      nextContext
    ).forEach(
      (value, key) =>
        result.set(key, value)
    );
  });

  return result;
}

function valuesEqualForAudit(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return String(a) === String(b);
  }
}

function buildWorkspaceAuditChanges(
  previousData,
  nextData,
  actor
) {
  const before =
    flattenWorkspaceForAudit(
      previousData?.projects || []
    );

  const after =
    flattenWorkspaceForAudit(
      nextData?.projects || []
    );

  const nodeIds =
    new Set([
      ...before.keys(),
      ...after.keys()
    ]);

  const changeSetId =
    `changeset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const createdAt =
    getNowIso();

  const entries = [];

  nodeIds.forEach((nodeId) => {
    const previous =
      before.get(nodeId);

    const next =
      after.get(nodeId);

    if (!previous && next) {
      entries.push({
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        changeSetId,
        actor,
        resource: {
          ...next.context,
          nodeId,
          nodeType:
            next.node.nodeType,
          module:
            next.node.nodeType
        },
        field: '__node__',
        operation: 'CREATE',
        previousValue: null,
        newValue:
          getNodeTitleFallback(next.node),
        source: 'WORKSPACE_SAVE',
        authorization: {
          mode: 'OWNER_OR_DELEGATED',
          grantId: null,
          changeRequestId: null
        },
        createdAt
      });
      return;
    }

    if (previous && !next) {
      entries.push({
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        changeSetId,
        actor,
        resource: {
          ...previous.context,
          nodeId,
          nodeType:
            previous.node.nodeType,
          module:
            previous.node.nodeType
        },
        field: '__node__',
        operation: 'DELETE',
        previousValue:
          getNodeTitleFallback(previous.node),
        newValue: null,
        source: 'WORKSPACE_SAVE',
        authorization: {
          mode: 'OWNER_OR_DELEGATED',
          grantId: null,
          changeRequestId: null
        },
        createdAt
      });
      return;
    }

    const fields =
      new Set([
        ...Object.keys(previous.flatValues),
        ...Object.keys(next.flatValues)
      ]);

    fields.forEach((field) => {
      const previousValue =
        previous.flatValues[field];

      const nextValue =
        next.flatValues[field];

      if (
        valuesEqualForAudit(
          previousValue,
          nextValue
        )
      ) {
        return;
      }

      const operation =
        previousValue === undefined
          ? 'CREATE'
          : nextValue === undefined
          ? 'DELETE'
          : 'UPDATE';

      entries.push({
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        changeSetId,
        actor,
        resource: {
          ...next.context,
          nodeId,
          nodeType:
            next.node.nodeType,
          module:
            next.node.nodeType
        },
        field,
        operation,
        previousValue:
          previousValue ?? null,
        newValue:
          nextValue ?? null,
        source: 'WORKSPACE_SAVE',
        authorization: {
          mode: 'OWNER_OR_DELEGATED',
          grantId: null,
          changeRequestId: null
        },
        createdAt
      });
    });
  });

  return entries;
}

function getNodeTitleFallback(node) {
  return (
    node?.title ||
    node?.values?.['project.name'] ||
    node?.values?.['product.style_name'] ||
    node?.values?.['variant.name'] ||
    node?.id ||
    ''
  );
}

function isGrantActive(grant) {
  if (!grant || grant.status === 'REVOKED') {
    return false;
  }

  if (
    grant.durationType === 'FIXED' &&
    grant.expiresAt
  ) {
    return (
      new Date(grant.expiresAt).getTime() >=
      Date.now()
    );
  }

  return true;
}

const PATTERN_LIBRARY_DB_NAME = 'perfectfit-workspace-pattern-library-v1';
const PATTERN_LIBRARY_STORE = 'files';
const patternLibraryBinaryCache = createIndexedDbRecordStore({
  dbName: PATTERN_LIBRARY_DB_NAME,
  storeName: PATTERN_LIBRARY_STORE
});

async function putPatternBinary(fileId, file) {
  return patternLibraryBinaryCache.put({
    id: fileId,
    blob: file,
    name: file.name,
    type: file.type,
    size: file.size,
    updatedAt: new Date().toISOString()
  });
}

async function getPatternBinary(fileId) {
  return patternLibraryBinaryCache.get(fileId);
}

async function deletePatternBinary(fileId) {
  return patternLibraryBinaryCache.remove(fileId);
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'item';
}

function getNowIso() {
  return new Date().toISOString();
}

function normalizeApprovalStatus(status) {
  return status === 'REVIEW'
    ? 'IN_REVIEW'
    : status || 'DRAFT';
}

function getApprovalResourceLabel(metadata, workflowKey, t) {
  const workflow =
    metadata.approval?.workflows?.[workflowKey];

  if (!workflow) {
    return workflowKey;
  }

  return (
    (workflow.resourceLabelKey
      ? t(workflow.resourceLabelKey)
      : '') ||
    workflow.resourceLabel ||
    workflowKey
  );
}

function createPublicationRequestId(metadata) {
  const prefix =
    metadata.approval?.workflows?.CATALOGUE_RELEASE
      ?.requestReferencePrefix ||
    'PUB';

  const stamp =
    new Date()
      .toISOString()
      .slice(0, 10)
      .replaceAll('-', '');

  const suffix =
    String(Date.now())
      .slice(-5);

  return `${prefix}-${stamp}-${suffix}`;
}

function isTechnicalReleaseComplete(items = []) {
  const technicalItems =
    items.filter(
      (item) =>
        [
          'TECH_PACK',
          'FIT_SPECIFICATION',
          'PATTERN_FILE',
          'SEWING_STANDARD'
        ].includes(
          item.workflowKey
        )
    );

  const techPackReleased =
    technicalItems.some(
      (item) =>
        item.workflowKey ===
          'TECH_PACK' &&
        item.status ===
          'RELEASED'
    );

  if (!techPackReleased) {
    return false;
  }

  return technicalItems.every(
    (item) =>
      [
        'APPROVED',
        'RELEASED',
        'SUPERSEDED'
      ].includes(
        item.status
      )
  );
}

function buildWorkspaceApprovalItems({
  metadata,
  project,
  variant,
  t
}) {
  const items = [];

  if (
    project?.values?.['project.status'] ===
    'DRAFT'
  ) {
    items.push({
      key: `PROJECT:${project.id}`,
      workflowKey: 'PROJECT',
      resourceLabel:
        getApprovalResourceLabel(
          metadata,
          'PROJECT',
          t
        ),
      title:
        project.values?.['project.name'] ||
        project.title ||
        'Project',
      subtitle:
        pfUiT('ui.workspace.project.subtitle', {}, 'Project lifecycle'),
      status:
        'DRAFT',
      target: {
        kind:
          'NODE_FIELD',
        nodeId:
          project.id,
        fieldKey:
          'project.status'
      }
    });
  }

  if (!variant) {
    return items;
  }

  const measurementNode =
    variant.children?.find(
      (child) =>
        child.nodeType ===
        'sizeSet'
    );

  if (measurementNode) {
    const measurementChart =
      measurementNode.values || {};

    items.push({
      key: `FIT_SPECIFICATION:${measurementNode.id}`,
      workflowKey: 'FIT_SPECIFICATION',
      resourceLabel:
        getApprovalResourceLabel(
          metadata,
          'FIT_SPECIFICATION',
          t
        ),
      title:
        `${measurementChart.revisionLabel || 'V1'} · Measurement & Fit`,
      subtitle:
        [
          measurementChart.fitProfile?.standardCategory,
          measurementChart.fitProfile?.silhouette
        ]
          .filter(Boolean)
          .join(' · '),
      status:
        normalizeApprovalStatus(
          measurementChart.status ||
          measurementChart.workflow?.status
        ),
      target: {
        kind: 'MEASUREMENT_CHART',
        nodeId: measurementNode.id,
        statusKey: 'status'
      }
    });
  }

  const techPackNode =
    variant.children?.find(
      (child) =>
        child.nodeType ===
        'techpack'
    );

  if (techPackNode) {
    items.push({
      key: `TECH_PACK:${techPackNode.id}`,
      workflowKey:
        'TECH_PACK',
      resourceLabel:
        getApprovalResourceLabel(
          metadata,
          'TECH_PACK',
          t
        ),
      title:
        techPackNode.values?.version ||
        techPackNode.title ||
        'Tech Pack',
      subtitle:
        variant.values?.[
          'variant.code'
        ] ||
        '',
      status:
        normalizeApprovalStatus(
          techPackNode.values?.status
        ),
      target: {
        kind:
          'NODE_FIELD',
        nodeId:
          techPackNode.id,
        fieldKey:
          'status'
      }
    });
  }

  const patternNode =
    variant.children?.find(
      (child) =>
        child.nodeType ===
        'patternLibrary'
    );

  (
    patternNode?.values?.files ||
    []
  ).forEach(
    (file) => {
      if (!file?.id) {
        return;
      }

      items.push({
        key:
          `PATTERN_FILE:${file.id}`,
        workflowKey:
          'PATTERN_FILE',
        resourceLabel:
          getApprovalResourceLabel(
            metadata,
            'PATTERN_FILE',
            t
          ),
        title:
          file.reference ||
          file.originalFilename ||
          'Pattern file',
        subtitle:
          [
            file.destination,
            file.format ||
              file.technicalType
          ]
            .filter(Boolean)
            .join(' · '),
        status:
          normalizeApprovalStatus(
            file.status
          ),
        target: {
          kind:
            'ARRAY_ITEM',
          nodeId:
            patternNode.id,
          collectionKey:
            'files',
          itemId:
            file.id,
          statusKey:
            'status'
        }
      });
    }
  );

  const sewingNode =
    variant.children?.find(
      (child) =>
        child.nodeType ===
        'sewing'
    );

  (
    sewingNode?.values?.operations ||
    []
  ).forEach(
    (operation) => {
      if (!operation?.id) {
        return;
      }

      items.push({
        key:
          `SEWING_STANDARD:${operation.id}`,
        workflowKey:
          'SEWING_STANDARD',
        resourceLabel:
          getApprovalResourceLabel(
            metadata,
            'SEWING_STANDARD',
            t
          ),
        title:
          [
            operation.step,
            operation.op ||
              operation.title ||
              'Operation'
          ]
            .filter(Boolean)
            .join(' · '),
        subtitle:
          [
            operation.machine,
            operation.method
          ]
            .filter(Boolean)
            .join(' · '),
        status:
          normalizeApprovalStatus(
            operation.standardStatus
          ),
        target: {
          kind:
            'ARRAY_ITEM',
          nodeId:
            sewingNode.id,
          collectionKey:
            'operations',
          itemId:
            operation.id,
          statusKey:
            'standardStatus'
        }
      });
    }
  );

  const unresolvedTechnicalDependencies =
    items.filter(
      (item) =>
        [
          'FIT_SPECIFICATION',
          'PATTERN_FILE',
          'SEWING_STANDARD'
        ].includes(
          item.workflowKey
        ) &&
        ![
          'APPROVED',
          'SUPERSEDED'
        ].includes(
          item.status
        )
    );

  const techPackApprovalItem =
    items.find(
      (item) =>
        item.workflowKey ===
        'TECH_PACK'
    );

  if (
    techPackApprovalItem &&
    techPackApprovalItem.status ===
      'IN_REVIEW' &&
    unresolvedTechnicalDependencies.length
  ) {
    techPackApprovalItem.blockedReason =
      `Approve ${unresolvedTechnicalDependencies.length} remaining technical item${
        unresolvedTechnicalDependencies.length === 1
          ? ''
          : 's'
      } before releasing the Tech Pack.`;
  }

  const technicalComplete =
    isTechnicalReleaseComplete(
      items
    );

  const publication =
    variant.values
      ?.publicationRelease ||
    {};

  const publicationStatus =
    publication.status
      ? normalizeApprovalStatus(
          publication.status
        )
      : technicalComplete
      ? 'READY_FOR_REVIEW'
      : 'NOT_READY';

  items.push({
    key:
      `CATALOGUE_RELEASE:${variant.id}`,
    workflowKey:
      'CATALOGUE_RELEASE',
    resourceLabel:
      getApprovalResourceLabel(
        metadata,
        'CATALOGUE_RELEASE',
        t
      ),
    title:
      publication.requestId ||
      'Customer publication',
    subtitle:
      variant.values?.[
        'variant.code'
      ] ||
      '',
    status:
      publicationStatus,
    requestId:
      publication.requestId ||
      null,
    moderatorNote:
      publication.moderatorNote ||
      '',
    canMessageModerator:
      Boolean(
        publication.requestId
      ) &&
      [
        'AWAITING_MODERATOR_RELEASE',
        'RETURNED_BY_MODERATOR',
        'PUBLISHED',
        'UNPUBLISHED'
      ].includes(
        publicationStatus
      ),
    blockedReason:
      technicalComplete
        ? ''
        : 'Complete the technical approval and release workflow before requesting moderator publication.',
    target: {
      kind:
        'PUBLICATION_RELEASE',
      nodeId:
        variant.id
    }
  });

  return items;
}

function applyApprovalTransitionToRecord({
  record,
  statusKey,
  transition,
  actor
}) {
  const now = getNowIso();
  const from =
    normalizeApprovalStatus(
      record?.[statusKey]
    );
  const to =
    normalizeApprovalStatus(
      transition.to
    );

  const event = {
    id: `workflow-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    action:
      transition.code,
    from,
    to,
    actor: {
      id: actor.id,
      name: actor.name,
      login: actor.login
    },
    at: now
  };

  const workflow = {
    ...(record.workflow || {}),
    status: to,
    history: [
      ...(record.workflow?.history || []),
      event
    ]
  };

  if (
    transition.code === 'SUBMIT'
  ) {
    workflow.submittedAt = now;
    workflow.submittedBy =
      event.actor;
  }

  if (
    transition.code === 'RETURN'
  ) {
    workflow.returnedAt = now;
    workflow.returnedBy =
      event.actor;
  }

  if (
    transition.code === 'APPROVE' ||
    transition.code ===
      'APPROVE_RELEASE' ||
    transition.code === 'ACTIVATE'
  ) {
    workflow.approvedAt = now;
    workflow.approvedBy =
      event.actor;
  }

  if (
    transition.code ===
    'APPROVE_RELEASE'
  ) {
    workflow.releasedAt = now;
    workflow.releasedBy =
      event.actor;
  }

  if (
    transition.code === 'ACTIVATE'
  ) {
    workflow.activatedAt = now;
    workflow.activatedBy =
      event.actor;
  }

  if (
    transition.code ===
      'REQUEST_MODERATOR_RELEASE' ||
    transition.code ===
      'RESUBMIT_MODERATOR_RELEASE'
  ) {
    workflow.requestedAt = now;
    workflow.requestedBy =
      event.actor;
  }

  if (
    transition.code ===
      'MODERATOR_RETURN'
  ) {
    workflow.moderatorReturnedAt = now;
    workflow.moderatorReturnedBy =
      event.actor;
  }

  if (
    transition.code ===
      'MODERATOR_PUBLISH' ||
    transition.code ===
      'REPUBLISH'
  ) {
    workflow.publishedAt = now;
    workflow.publishedBy =
      event.actor;
  }

  if (
    transition.code ===
      'UNPUBLISH'
  ) {
    workflow.unpublishedAt = now;
    workflow.unpublishedBy =
      event.actor;
  }

  return {
    ...record,
    [statusKey]: to,
    workflow
  };
}

function loadWorkspaceData(metadata) {
  const storageKey =
    metadata.storageKey ||
    `perfectfit_workspace_data_${metadata.version || 'v1'}`;

  try {
    const saved = runtimeDataStorage.getItem(storageKey);

    if (saved) {
      const parsed = JSON.parse(saved);
      const reconciled = reconcileWorkspaceModules(parsed);

      if (reconciled.changed) {
        try {
          runtimeDataStorage.setItem(storageKey, JSON.stringify(reconciled.data));
        } catch {}
      }

      return reconciled.data;
    }
  } catch {}

  return reconcileWorkspaceModules({
    version: metadata.version,
    selectedLocale: metadata.defaultLocale,
    projects: [],
    auditLog: [],
    collaboration: { grants: [] }
  }).data;
}

function findNodeById(nodes = [], nodeId) {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }

    const found = findNodeById(
      node.children || [],
      nodeId
    );

    if (found) {
      return found;
    }
  }

  return null;
}

function getVariantMediaNode(variant) {
  return (
    variant?.children?.find(
      (child) => child.nodeType === 'media'
    ) || null
  );
}

function getVariantPrimaryMediaAsset(variant) {
  const mediaNode = getVariantMediaNode(variant);
  const assets = Array.isArray(mediaNode?.values?.assets)
    ? mediaNode.values.assets
    : [];
  const slots = mediaNode?.values?.slots || {};

  return (
    assets.find((asset) => asset.id === slots.primaryAssetId) ||
    assets.find((asset) => asset.profileId === 'product-card') ||
    assets.find((asset) => asset.profileId === 'product-gallery') ||
    assets[0] ||
    null
  );
}

function findNodePath(
  nodes = [],
  nodeId,
  path = []
) {
  for (const node of nodes) {
    const nextPath = [
      ...path,
      node
    ];

    if (node.id === nodeId) {
      return nextPath;
    }

    const found = findNodePath(
      node.children || [],
      nodeId,
      nextPath
    );

    if (found.length) {
      return found;
    }
  }

  return [];
}

function updateNodeById(
  nodes = [],
  nodeId,
  updater
) {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return updater(node);
    }

    return {
      ...node,
      children: updateNodeById(
        node.children || [],
        nodeId,
        updater
      )
    };
  });
}

function removeNodeById(nodes = [], nodeId) {
  return nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => ({
      ...node,
      children: removeNodeById(node.children || [], nodeId)
    }));
}

function insertChildNode(nodes = [], parentId, childNode) {
  return nodes.map((node) => {
    if (node.id === parentId) {
      return {
        ...node,
        children: [
          ...(node.children || []),
          childNode
        ]
      };
    }

    return {
      ...node,
      children: insertChildNode(node.children || [], parentId, childNode)
    };
  });
}

function findFirstSelectable(nodes = []) {
  const firstProject = nodes[0];
  const firstStyle = firstProject?.children?.find((child) => child.nodeType === 'product');
  const firstVariant = firstStyle?.children?.find((child) => child.nodeType === 'variant');

  return firstVariant?.id || firstStyle?.id || firstProject?.id || null;
}

function createDefaultSizeMeasurements(sizes = ['XS', 'S', 'M', 'L', 'XL']) {
  return [
    'Bust',
    'Waist',
    'Hip',
    'Shoulder',
    'Back Length',
    'Sleeve Length'
  ].map((label, index) => ({
    id: `pom-${slugify(label)}-${index + 1}`,
    code: `POM-${String(index + 1).padStart(2, '0')}`,
    label,
    values: sizes.reduce((result, size) => ({
      ...result,
      [size]: ''
    }), {})
  }));
}

const VARIANT_MODULE_ORDER = [
  'projectJournal',
  'media',
  'patternLibrary',
  'sizeSet',
  'sewing',
  'techpack',
  'changeHistory'
];

function createProjectJournalChild(suffix) {
  return {
    id: `project-journal-${suffix}`,
    nodeType: 'projectJournal',
    title: 'Project Journal',
    values: {
      version: 'project-journal-v1'
    },
    children: []
  };
}

function ensureVariantModuleChildren(children = [], variantCode = '') {
  const suffix = slugify(variantCode || `variant-${Date.now()}`);
  const existing = new Map(children.map((child) => [child.nodeType, child]));
  const nextChildren = [
    ...(existing.has('projectJournal') ? [] : [createProjectJournalChild(suffix)]),
    ...children
  ];

  return nextChildren.sort((a, b) => {
    const aIndex = VARIANT_MODULE_ORDER.indexOf(a.nodeType);
    const bIndex = VARIANT_MODULE_ORDER.indexOf(b.nodeType);
    const safeA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const safeB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
    return safeA - safeB;
  });
}

function reconcileWorkspaceModules(data = { projects: [] }) {
  let changed = false;

  const reconcileNodes = (nodes = []) => nodes.map((node) => {
    const children = reconcileNodes(node.children || []);

    if (node.nodeType === 'variant') {
      const nextChildren = ensureVariantModuleChildren(
        children,
        node.values?.['variant.code'] || node.id
      );

      if (
        nextChildren.length !== children.length ||
        nextChildren.some((child, index) => child.id !== children[index]?.id)
      ) {
        changed = true;
      }

      return {
        ...node,
        children: nextChildren
      };
    }

    return {
      ...node,
      children
    };
  });

  return {
    data: {
      ...data,
      projects: reconcileNodes(data.projects || [])
    },
    changed
  };
}

function createDefaultSewingValues(metadata = workspaceMetadata) {
  const defaults = metadata.sewing?.defaults || {};
  return {
    constructionSteps: cloneValue(defaults.constructionSteps || []),
    notions: cloneValue(defaults.notions || []),
    seamAllowances: defaults.seamAllowances || '',
    qualityNotes: defaults.qualityNotes || '',
    qualityChecks: cloneValue(defaults.qualityChecks || []),
    operations: cloneValue(defaults.operations || []),
    timeMotion: cloneValue(defaults.timeMotion || {
      annotations: [],
      clips: [],
      approvedRevision: 0,
      approvedAt: null
    })
  };
}

function makeModuleChildren(variantCode, styleValues = {}) {
  const suffix = slugify(variantCode || `variant-${Date.now()}`);
  const defaultSizes = ['XS', 'S', 'M', 'L', 'XL'];

  return [
    createProjectJournalChild(suffix),
    {
      id: `media-${suffix}`,
      nodeType: 'media',
      title: 'Media',
      values: {
        assets: [],
        slots: {
          primaryAssetId: null,
          technicalSketchAssetId: null,
          patternAssetId: null
        }
      },
      children: []
    },
    {
      id: `pattern-library-${suffix}`,
      nodeType: 'patternLibrary',
      title: 'Pattern Library',
      values: {
        revision: 'R001',
        files: []
      },
      children: []
    },
    {
      id: `size-set-${suffix}`,
      nodeType: 'sizeSet',
      title: 'Measurement Chart',
      values: createDefaultMeasurementChartValues(defaultSizes, {
        displaySystem: 'ALPHA',
        unit: 'cm',
        baseReferenceLabel: 'M',
        metadata: workspaceMetadata,
        styleValues
      }),
      children: []
    },
    {
      id: `sewing-${suffix}`,
      nodeType: 'sewing',
      title: 'Sewing',
      values: createDefaultSewingValues(),
      children: []
    },
    {
      id: `techpack-${suffix}`,
      nodeType: 'techpack',
      title: 'Tech Pack',
      values: {
        version: 'TP-001',
        status: 'DRAFT',
        notes: '',
        exportHistory: []
      },
      children: []
    },
    {
      id: `change-history-${suffix}`,
      nodeType: 'changeHistory',
      title: 'Change History',
      values: {
        entries: []
      },
      children: []
    }
  ];
}

function createProjectNode(values = {}, ownerActor = null) {
  const name = values['project.name'] || 'New Project';
  const designerCode = generateProjectReference({
    name,
    existingReference: values['project.designer_code']
  });

  return {
    id: `project-${slugify(name)}-${Date.now()}`,
    nodeType: 'project',
    ownership: ownerActor
      ? {
          ownerIdentityId: ownerActor.id,
          ownerName: ownerActor.name,
          ownerLogin: ownerActor.login,
          ownerUsername: ownerActor.username,
          ownerBrandName: ownerActor.brandName,
          createdAt: getNowIso()
        }
      : undefined,
    values: {
      'project.name': name,
      'project.designer_code': designerCode,
      'project.season': values['project.season'] || 'SS26',
      'project.status': values['project.status'] || 'ACTIVE',
      ...values
    },
    children: []
  };
}

function createStyleNode(parentProject, values = {}) {
  const name = values['product.style_name'] || 'New Style';
  const designerCode = parentProject?.values?.['project.designer_code'] || 'PF';
  const styleCode = generateStyleReference({
    designerReference: designerCode,
    styleName: name,
    siblingReferences: (parentProject?.children || []).map((node) => node.values?.['product.style_code']),
    existingReference: values['product.style_code']
  });

  return {
    id: `product-${slugify(name)}-${Date.now()}`,
    nodeType: 'product',
    values: {
      'product.style_name': name,
      'product.style_code': styleCode,
      'product.category': values['product.category'] || 'DRESS',
      'product.development_stage': values['product.development_stage'] || 'DRAFTING',
      'product.difficulty': values['product.difficulty'] || 'INTERMEDIATE',
      'product.fit_silhouette': values['product.fit_silhouette'] || 'A_LINE',
      'product.description': values['product.description'] || '',
      ...values
    },
    children: []
  };
}

function createVariantNode(parentStyle, values = {}) {
  const name = values['variant.name'] || 'Original';
  const styleCode = parentStyle?.values?.['product.style_code'] || 'PF-STY-001';
  const variantCode = generateVariantReference({
    styleReference: styleCode,
    siblingCount: (parentStyle?.children || []).filter((child) => child.nodeType === 'variant').length,
    existingReference: values['variant.code']
  });

  return {
    id: `variant-${slugify(variantCode)}-${Date.now()}`,
    nodeType: 'variant',
    values: {
      'variant.name': name,
      'variant.code': variantCode,
      'variant.status': values['variant.status'] || 'DEVELOPMENT',
      'variant.size_system': values['variant.size_system'] || 'ALPHA',
      'variant.base_reference_size': values['variant.base_reference_size'] || 'M',
      'variant.notes': values['variant.notes'] || '',
      'variant.seo_title': values['variant.seo_title'] || '',
      'variant.seo_description': values['variant.seo_description'] || '',
      'variant.seo_slug': values['variant.seo_slug'] || '',
      'variant.tags': Array.isArray(values['variant.tags']) ? values['variant.tags'] : [],
      ...values
    },
    children: makeModuleChildren(variantCode, parentStyle?.values || {})
  };
}

function getPanelFieldKeys(
  metadata,
  nodeType
) {
  const panel =
    metadata.structure?.panels?.[nodeType];

  if (!panel) {
    return [];
  }

  return (panel.fieldGroups || []).flatMap(
    (groupKey) =>
      metadata.fieldGroups?.[groupKey]?.fields ||
      []
  );
}

function getNodeTitle(
  metadata,
  node,
  t
) {
  if (!node) {
    return '';
  }

  if (node.nodeType === 'sizeSet' && node.title === 'Size Set') {
    return t(metadata.structure?.treeTypes?.sizeSet?.labelKey);
  }

  if (node.title) {
    return node.title;
  }

  const typeMetadata =
    metadata.structure?.treeTypes?.[
      node.nodeType
    ];

  if (
    typeMetadata?.titleField &&
    node.values?.[typeMetadata.titleField]
  ) {
    return node.values[
      typeMetadata.titleField
    ];
  }

  const fieldKeys =
    getPanelFieldKeys(
      metadata,
      node.nodeType
    );

  for (const fieldKey of fieldKeys) {
    const value =
      node.values?.[fieldKey];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ''
    ) {
      const field =
        metadata.fields?.[fieldKey];

      if (
        field?.type === 'select' &&
        field.governanceList
      ) {
        const option =
          metadata.dropdowns?.[
            field.governanceList
          ]?.find(
            (item) =>
              item.code === value
          );

        if (option?.labelKey) {
          return t(option.labelKey);
        }
      }

      return String(value);
    }
  }

  return t(typeMetadata?.labelKey);
}

function getNodeIcon(
  metadata,
  nodeType
) {
  const iconKey =
    metadata.structure?.treeTypes?.[
      nodeType
    ]?.icon ||
    nodeType ||
    'default';

  return (
    ICON_REGISTRY[iconKey] ||
    ICON_REGISTRY.default
  );
}

function getFieldGroups(
  metadata,
  nodeType
) {
  const panel =
    metadata.structure?.panels?.[
      nodeType
    ];

  if (!panel) {
    return [];
  }

  return (panel.fieldGroups || [])
    .map((groupKey) => {
      const group =
        metadata.fieldGroups?.[
          groupKey
        ];

      if (!group) {
        return null;
      }

      return {
        key: groupKey,
        ...group,
        fields: (
          group.fields || []
        )
          .map(
            (fieldKey) =>
              metadata.fields?.[
                fieldKey
              ]
          )
          .filter(Boolean)
      };
    })
    .filter(Boolean);
}

function getDropdownLabel(
  metadata,
  listKey,
  value,
  t
) {
  if (!listKey || !value) {
    return '';
  }

  const option =
    metadata.dropdowns?.[
      listKey
    ]?.find(
      (item) =>
        item.code === value
    );

  if (!option) {
    return String(value);
  }

  return t(option.labelKey);
}

function TreeNode({
  metadata,
  node,
  depth,
  selectedNodeId,
  expandedNodes,
  openMenuNodeId,
  onSelect,
  onToggle,
  onOpenMenu,
  onAction,
  t
}) {
  const visibleChildren =
    (node.children || []).filter(
      (child) =>
        metadata.structure?.treeTypes?.[
          child.nodeType
        ]?.showInTree !== false
    );

  const isSelected =
    selectedNodeId === node.id;

  const hasChildren =
    visibleChildren.length > 0;

  const isExpanded =
    expandedNodes.has(node.id);

  const Icon =
    getNodeIcon(
      metadata,
      node.nodeType
    );

  const typeMetadata =
    metadata.structure?.treeTypes?.[
      node.nodeType
    ];

  return (
    <div>
      <div
        className={`group relative flex items-center rounded-[10px] transition-colors ${
          isSelected
            ? 'bg-bark-900 text-sand-50'
            : 'text-[#4A4741] hover:bg-[#EFEEE8]'
        }`}
        style={{
          marginLeft: `${depth * 12}px`
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (hasChildren) {
              onToggle(node.id);
            }
          }}
          className={`flex h-9 w-7 shrink-0 items-center justify-center ${
            hasChildren
              ? 'cursor-pointer'
              : 'cursor-default'
          }`}
          tabIndex={
            hasChildren ? 0 : -1
          }
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <Circle className="h-1.5 w-1.5 fill-current opacity-40" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            onSelect(node.id);
            onOpenMenu(null);
          }}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-8 text-left"
        >
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
              isSelected
                ? 'border-white/15 bg-white/10'
                : 'border-[#E5E2DA] bg-[#FCFBF8] text-[#7B5C49]'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-semibold">
              {getNodeTitle(
                metadata,
                node,
                t
              )}
            </span>

            <span
              className={`mt-0.5 block truncate text-[9px] uppercase tracking-[0.12em] ${
                isSelected
                  ? 'text-sand-300'
                  : 'text-[#918D84]'
              }`}
            >
              {t(
                typeMetadata?.labelKey
              )}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenMenu(openMenuNodeId === node.id ? null : node.id);
          }}
          className={`absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg transition-all ${
            isSelected
              ? 'text-white/85 hover:bg-white/15'
              : 'text-[#918D84] hover:bg-white hover:text-[#272622]'
          } ${
            openMenuNodeId === node.id
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
          }`}
          aria-label={`Actions for ${getNodeTitle(metadata, node, t)}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

      </div>

      {openMenuNodeId === node.id && (
        <div
          className="relative z-30 mt-1 rounded-[10px] border border-[#E5E2DA] bg-[#FCFBF8] p-1.5 text-[12px] text-[#272622] shadow-[0_14px_34px_rgba(39,38,34,0.12)]"
          style={{
            marginLeft: `${depth * 12 + 28}px`
          }}
          data-testid="workspace-tree-action-menu"
        >
          {node.nodeType === 'project' && (
            <button
              type="button"
              onClick={() => onAction('create-style', node)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[#EFEEE8]"
            >
              <Plus className="h-3.5 w-3.5" />{pfUiT("ui.components.workspace.792d5ca643")}</button>
          )}

          {node.nodeType === 'product' && (
            <button
              type="button"
              onClick={() => onAction('create-variant', node)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[#EFEEE8]"
            >
              <Plus className="h-3.5 w-3.5" />{pfUiT("ui.components.workspace.fccc50fffa")}</button>
          )}

          <button
            type="button"
            onClick={() => onAction('edit', node)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[#EFEEE8]"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit {t(typeMetadata?.labelKey)}
          </button>

          <button
            type="button"
            onClick={() => onAction('delete', node)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[#9A3D2F] hover:bg-[#F6EDEA]"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete {t(typeMetadata?.labelKey)}
          </button>
        </div>
      )}

      {hasChildren &&
        isExpanded && (
          <div className="mt-1 space-y-1">
            {visibleChildren.map(
              (child) => (
                <TreeNode
                  key={child.id}
                  metadata={metadata}
                  node={child}
                  depth={
                    depth + 1
                  }
                  selectedNodeId={
                    selectedNodeId
                  }
                  expandedNodes={
                    expandedNodes
                  }
                  openMenuNodeId={
                    openMenuNodeId
                  }
                  onSelect={
                    onSelect
                  }
                  onToggle={
                    onToggle
                  }
                  onOpenMenu={
                    onOpenMenu
                  }
                  onAction={
                    onAction
                  }
                  t={t}
                />
              )
            )}
          </div>
        )}
    </div>
  );
}

function WorkspaceField({
  metadata,
  field,
  value,
  onChange,
  t
}) {
  const label =
    field.label ||
    (field.labelKey ? t(field.labelKey) : '') ||
    field.key;

  const help =
    field.help ||
    (field.helpKey ? t(field.helpKey) : '');

  const options =
    field.governanceList
      ? metadata.dropdowns?.[
          field.governanceList
        ] || []
      : [];

  const baseClass =
    'w-full rounded-[9px] border border-[#E5E2DA] bg-[#FCFBF8] px-3 py-2 text-[13px] text-[#272622] transition-colors focus:border-[#BCA892] focus:outline-none focus:ring-1 focus:ring-[#BCA892]/30 disabled:bg-[#F4F2ED] disabled:text-[#918D84]';

  const optionLabel = (option) =>
    option?.label ||
    (option?.labelKey ? t(option.labelKey) : '') ||
    option?.eipV1Value ||
    option?.code ||
    '';

  if (field.type === 'multiselect') {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2 md:col-span-2">
        <label className="block text-[10px] font-semibold uppercase tracking-[0.13em] text-bark-500">
          {label}
        </label>
        <div className="flex flex-wrap gap-2 rounded-[9px] border border-[#E5E2DA] bg-[#FCFBF8] p-2.5">
          {options.map((option) => {
            const active = selected.includes(option.code);
            return (
              <button
                key={option.code}
                type="button"
                disabled={Boolean(field.readOnly)}
                aria-pressed={active}
                onClick={() => {
                  const next = active
                    ? selected.filter((code) => code !== option.code)
                    : [...selected, option.code];
                  onChange(field.key, next);
                }}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  active
                    ? 'border-[#7B5C49] bg-[#7B5C49] text-white'
                    : 'border-[#D9D5CC] bg-white text-[#4A4741] hover:border-[#BCA892]'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {optionLabel(option)}
              </button>
            );
          })}
          {!options.length && (
            <span className="text-[11px] text-[#918D84]">No governed options available</span>
          )}
        </div>
        {help && (
          <p className="text-[10px] leading-relaxed text-bark-400">{help}</p>
        )}
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div className="space-y-1.5">
        <label className="block text-[10px] font-semibold uppercase tracking-[0.13em] text-bark-500">
          {label}
        </label>

        <select
          value={value ?? ''}
          required={
            Boolean(field.required)
          }
          disabled={
            Boolean(field.readOnly)
          }
          onChange={(event) =>
            onChange(
              field.key,
              event.target.value
            )
          }
          className={baseClass}
        >
          {field.allowEmpty !==
            false && (
            <option value="" />
          )}

          {options.map(
            (option) => (
              <option
                key={
                  option.code
                }
                value={
                  option.code
                }
              >
                {optionLabel(option)}
              </option>
            )
          )}
        </select>

        {help && (
          <p className="text-[10px] leading-relaxed text-bark-400">
            {help}
          </p>
        )}
      </div>
    );
  }

  if (
    field.type === 'textarea'
  ) {
    return (
      <div className="space-y-1.5 md:col-span-2">
        <label className="block text-[10px] font-semibold uppercase tracking-[0.13em] text-bark-500">
          {label}
        </label>

        <textarea
          value={value ?? ''}
          required={
            Boolean(field.required)
          }
          readOnly={
            Boolean(field.readOnly)
          }
          rows={
            field.rows || 5
          }
          onChange={(event) =>
            onChange(
              field.key,
              event.target.value
            )
          }
          className={`${baseClass} resize-y leading-relaxed`}
        />

        {help && (
          <p className="text-[10px] leading-relaxed text-bark-400">
            {help}
          </p>
        )}
      </div>
    );
  }

  if (
    field.type === 'checkbox'
  ) {
    return (
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-sand-200 bg-sand-50/40 px-3 py-3">
        <input
          type="checkbox"
          checked={
            Boolean(value)
          }
          disabled={
            Boolean(field.readOnly)
          }
          onChange={(event) =>
            onChange(
              field.key,
              event.target.checked
            )
          }
          className="h-4 w-4 rounded border-sand-300 accent-clay-700"
        />

        <span>
          <span className="block text-xs font-semibold text-bark-800">
            {label}
          </span>

          {help && (
            <span className="mt-0.5 block text-[10px] leading-relaxed text-bark-400">
              {help}
            </span>
          )}
        </span>
      </label>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-semibold uppercase tracking-[0.13em] text-bark-500">
        {label}
      </label>

      <input
        type={
          field.type ===
          'number'
            ? 'number'
            : field.type ===
              'date'
            ? 'date'
            : 'text'
        }
        value={value ?? ''}
        required={
          Boolean(field.required)
        }
        readOnly={
          Boolean(field.readOnly)
        }
        min={field.min}
        max={field.max}
        step={field.step}
        onChange={(event) => {
          const nextValue =
            field.type ===
              'number' &&
            event.target.value !== ''
              ? Number(
                  event.target
                    .value
                )
              : event.target
                  .value;

          onChange(
            field.key,
            nextValue
          );
        }}
        className={baseClass}
      />

      {help && (
        <p className="text-[10px] leading-relaxed text-bark-400">
          {help}
        </p>
      )}
    </div>
  );
}

function MetadataForm({
  metadata,
  node,
  onFieldChange,
  t
}) {
  const groups =
    getFieldGroups(
      metadata,
      node.nodeType
    );

  if (!groups.length) {
    return null;
  }

  return (
    <div className="space-y-5">
      {groups.map(
        (group) => (
          <section
            key={group.key}
            className="rounded-xl border border-sand-200 bg-white"
          >
            {(group.label || group.labelKey) && (
              <div className="border-b border-sand-150 px-5 py-4">
                <h3 className="font-serif text-lg font-medium text-bark-900">
                  {group.label || t(group.labelKey)}
                </h3>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
              {group.fields.map(
                (field) => (
                  <WorkspaceField
                    key={
                      field.key
                    }
                    metadata={
                      metadata
                    }
                    field={
                      field
                    }
                    value={
                      node.values?.[
                        field.key
                      ]
                    }
                    onChange={
                      onFieldChange
                    }
                    t={t}
                  />
                )
              )}
            </div>
          </section>
        )
      )}
    </div>
  );
}

function EmptyModule({
  metadata,
  node,
  t
}) {
  const typeMetadata =
    metadata.structure?.treeTypes?.[
      node.nodeType
    ];

  const Icon =
    getNodeIcon(
      metadata,
      node.nodeType
    );

  return (
    <div className="flex min-h-[440px] items-center justify-center rounded-xl border border-sand-200 bg-white">
      <div className="max-w-md px-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-sand-200 bg-sand-50 text-clay-700">
          <Icon className="h-6 w-6" />
        </div>

        <h3 className="mt-4 font-serif text-2xl font-medium text-bark-900">
          {t(
            typeMetadata?.labelKey
          )}
        </h3>

        {typeMetadata?.descriptionKey && (
          <p className="mt-2 text-sm leading-relaxed text-bark-500">
            {t(
              typeMetadata
                .descriptionKey
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function FieldValue({ label, value, children }) {
  return (
    <div className="min-w-0 rounded-[10px] border border-[#E5E2DA] bg-[#FCFBF8] px-3 py-2.5">
      <div className="text-[11px] font-semibold text-[#6F6C65]">
        {label}
      </div>
      <div className="mt-1 truncate text-[13px] font-medium text-[#272622]">
        {children || value || '—'}
      </div>
    </div>
  );
}

function OverviewModule({
  metadata,
  variant,
  style,
  project,
  onChange,
  t
}) {
  const styleValues = style?.values || {};
  const variantValues = variant?.values || {};
  const projectValues = project?.values || {};
  const primaryAsset = getVariantPrimaryMediaAsset(variant);
  const [overviewImageUrl, setOverviewImageUrl] = useState('');

  const category = getDropdownLabel(metadata, 'GARMENT_CATEGORY', styleValues['product.category'], t);
  const stage = getDropdownLabel(metadata, 'PRODUCT_DEVELOPMENT_STAGE', styleValues['product.development_stage'], t);
  const status = getDropdownLabel(metadata, 'VARIANT_STATUS', variantValues['variant.status'], t);
  const difficulty = getDropdownLabel(metadata, 'DIFFICULTY_LEVEL', styleValues['product.difficulty'], t);
  const fitSilhouette = getDropdownLabel(metadata, 'FIT_SILHOUETTE', styleValues['product.fit_silhouette'], t);
  const sizeSystem = getDropdownLabel(metadata, 'SIZE_SYSTEM', variantValues['variant.size_system'], t);
  const baseSize = getDropdownLabel(metadata, 'BASE_REFERENCE_SIZE', variantValues['variant.base_reference_size'], t);
  const primaryAssetSource = primaryAsset?.previewUrl || primaryAsset?.url || overviewImageUrl;
  const discoverySeoGroup = getFieldGroups(metadata, 'variant').find(
    (group) => group.key === 'variantDiscoverySeo'
  );

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';

    setOverviewImageUrl('');

    if (!primaryAsset?.id || primaryAsset.previewUrl || primaryAsset.url) {
      return undefined;
    }

    loadMediaFile(primaryAsset.id)
      .then((file) => {
        if (!file || cancelled) return;

        objectUrl = URL.createObjectURL(file);
        setOverviewImageUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setOverviewImageUrl('');
        }
      });

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [primaryAsset?.id, primaryAsset?.previewUrl, primaryAsset?.url]);

  const handleTargetChange = (targetId) => (fieldKey, value) => {
    if (!targetId) return;
    onChange(fieldKey, value, targetId);
  };

  const compactFields = [
    ['product.style_code', styleValues['product.style_code'], style?.id],
    ['variant.code', variantValues['variant.code'], variant?.id],
    ['product.category', styleValues['product.category'], style?.id],
    ['project.season', projectValues['project.season'], project?.id],
    ['project.designer_code', projectValues['project.designer_code'], project?.id],
    ['product.difficulty', styleValues['product.difficulty'], style?.id],
    ['product.fit_silhouette', styleValues['product.fit_silhouette'], style?.id],
    ['product.development_stage', styleValues['product.development_stage'], style?.id],
    ['variant.status', variantValues['variant.status'], variant?.id],
    ['variant.size_system', variantValues['variant.size_system'], variant?.id],
    ['variant.base_reference_size', variantValues['variant.base_reference_size'], variant?.id],
    ['variant.name', variantValues['variant.name'], variant?.id]
  ].filter(([fieldKey, , targetId]) => metadata.fields[fieldKey] && targetId);

  return (
    <div className="space-y-3">
      <section className="rounded-[12px] border border-[#E5E2DA] bg-[#FCFBF8]">
        <div className="flex items-center justify-between border-b border-[#E5E2DA] px-4 py-3">
          <h3 className="text-[15px] font-semibold text-[#272622]">{pfUiT("ui.components.workspace.2f39e4512e")}</h3>
          <span className="rounded-full border border-[#D9D5CC] bg-[#F4F2ED] px-2.5 py-1 text-[11px] font-medium text-[#6F6C65]">{pfUiT("ui.components.workspace.48556d37d2")}</span>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_190px]">
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {compactFields.map(([fieldKey, value, targetId]) => (
                <WorkspaceField
                  key={`${targetId}-${fieldKey}`}
                  metadata={metadata}
                  field={metadata.fields[fieldKey]}
                  value={value}
                  onChange={handleTargetChange(targetId)}
                  t={t}
                />
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <label className="space-y-1.5">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.13em] text-bark-500">
                  {t(metadata.fields['product.description'].labelKey)}
                </span>
                <textarea
                  value={styleValues['product.description'] || ''}
                  onChange={(event) => onChange('product.description', event.target.value, style?.id)}
                  rows={4}
                  className="w-full resize-y rounded-[9px] border border-[#E5E2DA] bg-[#FCFBF8] px-3 py-2 text-[13px] leading-relaxed text-[#272622] transition-colors focus:border-[#BCA892] focus:outline-none focus:ring-1 focus:ring-[#BCA892]/30"
                  placeholder={pfUiT("ui.components.workspace.c6474d4c46")}
                />
              </label>

              <label className="space-y-1.5">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.13em] text-bark-500">
                  {t(metadata.fields['variant.notes'].labelKey)}
                </span>
                <textarea
                  value={variantValues['variant.notes'] || ''}
                  onChange={(event) => onChange('variant.notes', event.target.value, variant?.id)}
                  rows={4}
                  className="w-full resize-y rounded-[9px] border border-[#E5E2DA] bg-[#FCFBF8] px-3 py-2 text-[13px] leading-relaxed text-[#272622] transition-colors focus:border-[#BCA892] focus:outline-none focus:ring-1 focus:ring-[#BCA892]/30"
                  placeholder={pfUiT("ui.components.workspace.f23e80e710")}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              {[category, difficulty && `Difficulty: ${difficulty}`, fitSilhouette && `Fit: ${fitSilhouette}`, stage, status, sizeSystem, baseSize && `Base ${baseSize}`]
                .filter(Boolean)
                .map((item) => (
                  <span key={item} className="rounded-full border border-[#D9D5CC] bg-[#F4F2ED] px-3 py-1.5 text-[12px] text-[#4A4741]">
                    {item}
                  </span>
                ))}
            </div>
          </div>

          <div className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-[10px] border border-[#E5E2DA] bg-[#F4F2ED] text-center">
            {primaryAssetSource ? (
              <img
                src={primaryAssetSource}
                alt={primaryAsset?.title || getNodeTitle(metadata, variant, t)}
                className="h-full max-h-[240px] w-full rounded-[10px] object-cover"
              />
            ) : (
              <div className="px-4 text-[#918D84]">
                <ImageIcon className="mx-auto h-8 w-8" />
                <p className="mt-2 text-[12px] leading-relaxed">
                  {primaryAsset?.fileName || 'No primary image assigned'}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {discoverySeoGroup && (
        <section className="rounded-[12px] border border-[#E5E2DA] bg-[#FCFBF8]">
          <div className="border-b border-[#E5E2DA] px-4 py-3">
            <h3 className="text-[15px] font-semibold text-[#272622]">
              {discoverySeoGroup.label ||
                (discoverySeoGroup.labelKey ? t(discoverySeoGroup.labelKey) : 'Discovery & SEO')}
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
            {discoverySeoGroup.fields.map((field) => (
              <WorkspaceField
                key={`${variant?.id}-${field.key}`}
                metadata={metadata}
                field={field}
                value={variantValues[field.key]}
                onChange={handleTargetChange(variant?.id)}
                t={t}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function LegacyOverviewModule({
  metadata,
  node,
  variant,
  style,
  project,
  onChange,
  t
}) {
  const styleValues = style?.values || {};
  const variantValues = variant?.values || {};
  const projectValues = project?.values || {};
  const mediaNode = variant?.children?.find((child) => child.nodeType === 'media');
  const primaryAsset = (mediaNode?.values?.assets || []).find(
    (asset) => asset.id === mediaNode?.values?.slots?.primaryAssetId
  ) || (mediaNode?.values?.assets || [])[0];

  const category = getDropdownLabel(metadata, 'GARMENT_CATEGORY', styleValues['product.category'], t);
  const stage = getDropdownLabel(metadata, 'PRODUCT_DEVELOPMENT_STAGE', styleValues['product.development_stage'], t);
  const status = getDropdownLabel(metadata, 'VARIANT_STATUS', variantValues['variant.status'], t);
  const difficulty = getDropdownLabel(metadata, 'DIFFICULTY_LEVEL', styleValues['product.difficulty'], t);
  const sizeSystem = getDropdownLabel(metadata, 'SIZE_SYSTEM', variantValues['variant.size_system'], t);
  const baseSize = getDropdownLabel(metadata, 'BASE_REFERENCE_SIZE', variantValues['variant.base_reference_size'], t);

  return (
    <div className="space-y-4">
      <section className="rounded-[12px] border border-[#E5E2DA] bg-[#FCFBF8]">
        <div className="flex items-center justify-between border-b border-[#E5E2DA] px-4 py-3">
          <h3 className="text-[15px] font-semibold text-[#272622]">{pfUiT("ui.components.workspace.2f39e4512e")}</h3>
          <span className="rounded-full border border-[#D9D5CC] bg-[#F4F2ED] px-2.5 py-1 text-[11px] font-medium text-[#6F6C65]">{pfUiT("ui.components.workspace.c866815f3e")}</span>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_165px]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FieldValue label="Style Code / Reference" value={styleValues['product.style_code']} />
            <FieldValue label="Category / Garment Type" value={category} />
            <FieldValue label="Season / Collection" value={projectValues['project.season']} />
            <FieldValue label="Development Stage">
              <span className="inline-flex rounded-full bg-[#EFEEE8] px-2 py-0.5 text-[12px] text-[#272622]">
                {stage || status || '—'}
              </span>
            </FieldValue>
            <FieldValue label="Designer" value={projectValues['project.designer_code']} />
            <FieldValue label="Fit / Silhouette" value={difficulty} />
            <FieldValue label="Size Range" value={sizeSystem ? `${sizeSystem}${baseSize ? ` · Base ${baseSize}` : ''}` : baseSize} />
            <FieldValue label="Priority">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#9A7B58]" />{pfUiT("ui.components.workspace.9bafb9a634")}</span>
            </FieldValue>
          </div>

          <div className="flex min-h-[220px] items-center justify-center rounded-[10px] border border-[#E5E2DA] bg-[#F4F2ED] text-center">
            {primaryAsset?.previewUrl || primaryAsset?.url ? (
              <img
                src={primaryAsset.previewUrl || primaryAsset.url}
                alt={primaryAsset.title || getNodeTitle(metadata, variant, t)}
                className="h-full max-h-[240px] w-full rounded-[10px] object-cover"
              />
            ) : (
              <div className="px-4 text-[#918D84]">
                <ImageIcon className="mx-auto h-8 w-8" />
                <p className="mt-2 text-[12px] leading-relaxed">
                  {primaryAsset?.fileName || 'No primary image assigned'}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[12px] border border-[#E5E2DA] bg-[#FCFBF8] p-4">
          <h3 className="text-[15px] font-semibold text-[#272622]">{pfUiT("ui.components.workspace.d190da2576")}</h3>
          <textarea
            value={styleValues['product.description'] || ''}
            onChange={(event) => onChange('product.description', event.target.value, style?.id)}
            rows={5}
            className="mt-3 w-full resize-y rounded-[10px] border border-[#E5E2DA] bg-[#F8F7F3] px-3 py-2 text-[13px] leading-relaxed text-[#272622] focus:border-[#BCA892] focus:outline-none focus:ring-1 focus:ring-[#BCA892]/30"
            placeholder={pfUiT("ui.components.workspace.c6474d4c46")}
          />
        </section>

        <section className="rounded-[12px] border border-[#E5E2DA] bg-[#FCFBF8] p-4">
          <h3 className="text-[15px] font-semibold text-[#272622]">{pfUiT("ui.components.workspace.772de861db")}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {[category, difficulty, stage, status, sizeSystem, baseSize && `Base ${baseSize}`]
              .filter(Boolean)
              .map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[#D9D5CC] bg-[#F4F2ED] px-3 py-1.5 text-[12px] text-[#4A4741]"
                >
                  {item}
                </span>
              ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <WorkspaceField
              metadata={metadata}
              field={metadata.fields['variant.status']}
              value={variantValues['variant.status']}
              onChange={onChange}
              t={t}
            />
            <WorkspaceField
              metadata={metadata}
              field={metadata.fields['variant.base_reference_size']}
              value={variantValues['variant.base_reference_size']}
              onChange={onChange}
              t={t}
            />
          </div>
        </section>
      </div>

      <MetadataForm
        metadata={metadata}
        node={node}
        onFieldChange={onChange}
        t={t}
      />
    </div>
  );
}

function normalizePatternLibraryValues(values = {}, variant) {
  const legacyFiles = [
    ...(values.masterPatterns || []).map((item) => ({ ...item, destination: 'MASTER' })),
    ...(values.gradedPatterns || []).map((item) => ({ ...item, destination: 'SIZE_SET' })),
    ...(values.outputFiles || []).map((item) => ({ ...item, destination: 'SIZE_SET' }))
  ];

  return {
    revision: values.revision || 'R001',
    baseReferenceSize: variant?.values?.['variant.base_reference_size'] || values.baseReferenceSize || '',
    files: Array.isArray(values.files) ? values.files : legacyFiles
  };
}

function getSizeSetFiles(library) {
  return (library.files || []).filter((file) => file.destination === 'SIZE_SET');
}

function getPatternLibraryFiles(library) {
  return (library.files || []).filter((file) => file.destination !== 'SIZE_SET');
}

function PatternLibraryModule({
  metadata,
  node,
  variant,
  onChange,
  t
}) {
  const library = normalizePatternLibraryValues(node.values || {}, variant);
  const measurementChart = normalizeMeasurementChartValues(
    variant?.children?.find((child) => child.nodeType === 'sizeSet')?.values || {},
    variant?.values || {},
    metadata
  );
  const expectedSizes = getDisplaySizeReferences(measurementChart, measurementChart.displaySystem);
  const libraryFiles = library.files || [];
  const [activeTab, setActiveTab] = useState('MASTER');
  const [selectedFileId, setSelectedFileId] = useState(libraryFiles[0]?.id || null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadForm, setUploadForm] = useState(() => ({
    file: null,
    destination: 'MASTER',
    sourceProvider: 'MANUAL_UNSPECIFIED',
    technicalType: 'CLO_PATTERN_PACX',
    masterRole: 'AUTHORITATIVE',
    sizeSetName: 'DXF-AAMA',
    coveredSizes: expectedSizes,
    status: 'DRAFT',
    notes: ''
  }));

  const typeOptions = metadata.dropdowns?.PATTERN_TECHNICAL_TYPE || [];
  const providerOptions = metadata.dropdowns?.PATTERN_SOURCE_PROVIDER || [];
  const variantCode = variant?.values?.['variant.code'] || 'PF-V01';

  const filteredFiles = libraryFiles.filter((file) => {
    if (activeTab === 'MASTER') return file.destination === 'MASTER';
    if (activeTab === 'SIZE_SET') return file.destination === 'SIZE_SET';
    return file.destination === 'SUPPORTING';
  });
  const selectedFile = filteredFiles.find((file) => file.id === selectedFileId) || filteredFiles[0] || null;

  const updateLibrary = (nextValues) => {
    onChange('files', nextValues.files, node.id, {
      ...library,
      ...nextValues
    });
  };

  const persistLibrary = (nextLibrary) => {
    onChange('__replaceValues', null, node.id, nextLibrary);
  };

  const createReference = () => {
    return generatePatternFileReference({
      variantReference: variantCode,
      existingReferences: library.files.map((file) => file.reference)
    });
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    setUploadError('');

    if (!uploadForm.file) {
      setUploadError('Select a pattern file before confirming upload.');
      return;
    }

    const typeOption = typeOptions.find((option) => option.code === uploadForm.technicalType) || {};
    const now = getNowIso();
    const id = `pattern-file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    try {
      await putPatternBinary(id, uploadForm.file);
    } catch (error) {
      setUploadError(error.message || 'Could not store this file locally.');
      return;
    }

    const nextFile = {
      id,
      reference: createReference(),
      originalFilename: uploadForm.file.name,
      fileSize: uploadForm.file.size,
      mimeType: uploadForm.file.type || '',
      destination: uploadForm.destination,
      technicalRole: uploadForm.destination === 'MASTER' ? uploadForm.masterRole : uploadForm.destination,
      authoritative: uploadForm.destination === 'MASTER' && uploadForm.masterRole === 'AUTHORITATIVE',
      sourceProvider: uploadForm.sourceProvider,
      intakeMethod: 'MANUAL_UPLOAD',
      technicalType: uploadForm.technicalType,
      format: typeOption.format || '',
      outputProfile: typeOption.outputProfile || '',
      sizeSetName: uploadForm.destination === 'SIZE_SET' ? uploadForm.sizeSetName : '',
      coveredSizes: uploadForm.destination === 'SIZE_SET' ? uploadForm.coveredSizes : [],
      status: uploadForm.status,
      notes: uploadForm.notes,
      createdAt: now,
      updatedAt: now
    };

    const files = library.files.map((file) => (
      nextFile.authoritative && file.destination === 'MASTER'
        ? { ...file, authoritative: false, technicalRole: file.technicalRole === 'AUTHORITATIVE' ? 'SUPPORTING' : file.technicalRole }
        : file
    ));

    const nextLibrary = {
      ...library,
      files: [...files, nextFile]
    };

    persistLibrary(nextLibrary);
    setSelectedFileId(id);
    setActiveTab(uploadForm.destination);
    setUploadOpen(false);
    setUploadForm((current) => ({
      ...current,
      file: null,
      notes: ''
    }));
  };

  const handleDeleteFile = async (fileId) => {
    const file = library.files.find((item) => item.id === fileId);
    if (!file) return;

    const confirmed = window.confirm(`Delete ${file.reference || file.originalFilename}? This also removes the locally stored binary.`);
    if (!confirmed) return;

    try {
      await deletePatternBinary(fileId);
    } catch {}

    const nextFiles = library.files.filter((item) => item.id !== fileId);
    persistLibrary({
      ...library,
      files: nextFiles
    });
    setSelectedFileId(nextFiles[0]?.id || null);
  };

  const handleDownload = async (file) => {
    if (!file) return;

    const stored = await getPatternBinary(file.id);
    if (!stored?.blob) return;

    const url = URL.createObjectURL(stored.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = stored.name || file.originalFilename || `${file.reference}.bin`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleReplaceFile = async (file, replacementFile) => {
    if (!file || !replacementFile) return;

    try {
      await putPatternBinary(file.id, replacementFile);
    } catch {
      return;
    }

    persistLibrary({
      ...library,
      files: library.files.map((item) => (
        item.id === file.id
          ? {
              ...item,
              originalFilename: replacementFile.name,
              fileSize: replacementFile.size,
              mimeType: replacementFile.type || item.mimeType || '',
              updatedAt: getNowIso()
            }
          : item
      ))
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[12px] border border-[#E5E2DA] bg-[#FCFBF8] px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-[16px] font-semibold text-[#272622]">{pfUiT("ui.components.workspace.c9358784cc")}</h3>
          <div className="mt-1 flex flex-wrap gap-2 text-[12px] text-[#6F6C65]">
            <span>Revision {library.revision}</span>
            <span>Base {library.baseReferenceSize}</span>
            <span>{libraryFiles.length} pattern files</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-[9px] bg-[#272622] px-3.5 text-[12px] font-semibold text-white hover:bg-[#3A3934]"
        >
          <Upload className="h-4 w-4" />{pfUiT("ui.components.workspace.7d68aa1cd2")}</button>
      </div>

      <div className="rounded-[12px] border border-[#E5E2DA] bg-[#FCFBF8]">
        <div className="flex gap-1 border-b border-[#E5E2DA] px-3 py-2">
          {[
            ['MASTER', t('patternLibrary.tab.master')],
            ['SIZE_SET', t('patternLibrary.tab.sizeSets')],
            ['SUPPORTING', t('patternLibrary.tab.supporting')]
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`rounded-[9px] px-3 py-2 text-[12px] font-medium ${
                activeTab === key
                  ? 'bg-[#EFEEE8] text-[#272622]'
                  : 'text-[#6F6C65] hover:bg-[#F4F2ED]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid min-h-[420px] lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="overflow-auto">
            <div className="hidden">
              <table className="min-w-full text-left text-[12px]">
                <thead className="border-b border-[#E5E2DA] text-[11px] uppercase tracking-[0.12em] text-[#918D84]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{pfUiT("ui.components.workspace.23b236e131")}</th>
                    <th className="px-4 py-3 font-semibold">{pfUiT("ui.components.workspace.c3328c7ac2")}</th>
                    <th className="px-4 py-3 font-semibold">{pfUiT("ui.components.workspace.2ba050b648")}</th>
                    <th className="px-4 py-3 font-semibold">{pfUiT("ui.components.workspace.4a65be85a1")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[].map((row) => (
                    <tr
                      key={row.key}
                      className="border-b border-[#EEEAE2]"
                    >
                      <td className="px-4 py-3 font-medium text-[#272622]">{row.key}</td>
                      <td className="px-4 py-3 text-[#6F6C65]">
                        {row.coveredSizes.length} / {expectedSizes.length} complete
                        {row.missingSizes.length > 0 && ` · ${row.missingSizes.join(', ')} missing`}
                      </td>
                      <td className="px-4 py-3 text-[#6F6C65]">{row.missingSizes.length ? 'In Review' : 'Complete'}</td>
                      <td className="px-4 py-3 text-[#6F6C65]">{row.files[0]?.updatedAt?.slice(0, 10) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              <table className="min-w-full text-left text-[12px]">
                <thead className="border-b border-[#E5E2DA] text-[11px] uppercase tracking-[0.12em] text-[#918D84]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{pfUiT("ui.components.workspace.23b236e131")}</th>
                    <th className="px-4 py-3 font-semibold">{pfUiT("ui.components.workspace.53090b0ff2")}</th>
                    <th className="px-4 py-3 font-semibold">{pfUiT("ui.components.workspace.c3328c7ac2")}</th>
                    <th className="px-4 py-3 font-semibold">{pfUiT("ui.components.workspace.2ba050b648")}</th>
                    <th className="px-4 py-3 font-semibold">{pfUiT("ui.components.workspace.4a65be85a1")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map((file) => (
                    <tr
                      key={file.id}
                      onClick={() => setSelectedFileId(file.id)}
                      className={`cursor-pointer border-b border-[#EEEAE2] ${
                        selectedFile?.id === file.id ? 'bg-[#EFEEE8]' : 'hover:bg-[#F8F7F3]'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#272622]">{file.reference}</div>
                        <div className="mt-0.5 max-w-[240px] truncate text-[#918D84]">{file.originalFilename}</div>
                      </td>
                      <td className="px-4 py-3 text-[#6F6C65]">{file.format || file.technicalType}{file.outputProfile ? ` · ${file.outputProfile}` : ''}</td>
                      <td className="px-4 py-3 text-[#6F6C65]">{file.coveredSizes?.length ? file.coveredSizes.join(', ') : '—'}</td>
                      <td className="px-4 py-3 text-[#6F6C65]">{file.status || 'DRAFT'}</td>
                      <td className="px-4 py-3 text-[#6F6C65]">{file.updatedAt?.slice(0, 10) || '—'}</td>
                    </tr>
                  ))}
                  {filteredFiles.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[13px] text-[#6F6C65]">{pfUiT("ui.components.workspace.2b72cc4f05")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
          </div>

          <aside className="border-t border-[#E5E2DA] bg-[#F8F7F3] p-4 lg:border-l lg:border-t-0">
            {selectedFile ? (
              <div className="space-y-3 text-[12px]">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#918D84]">{pfUiT("ui.components.workspace.19babac774")}</div>
                  <div className="mt-1 text-[15px] font-semibold text-[#272622]">{selectedFile.reference}</div>
                </div>
                {[
                  ['Original filename', selectedFile.originalFilename],
                  ['Technical role', selectedFile.authoritative ? 'Authoritative master' : selectedFile.technicalRole],
                  ['Format', selectedFile.format],
                  ['Output profile', selectedFile.outputProfile],
                  ['Source provider', getDropdownLabel(metadata, 'PATTERN_SOURCE_PROVIDER', selectedFile.sourceProvider, t)],
                  ['Intake method', selectedFile.intakeMethod],
                  ['Covered sizes', selectedFile.coveredSizes?.join(', ')],
                  ['Status', getDropdownLabel(metadata, 'PATTERN_FILE_STATUS', selectedFile.status, t)],
                  ['Updated', selectedFile.updatedAt?.slice(0, 10)]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[9px] border border-[#E5E2DA] bg-[#FCFBF8] px-3 py-2">
                    <div className="text-[#918D84]">{label}</div>
                    <div className="mt-0.5 font-medium text-[#272622]">{value || '—'}</div>
                  </div>
                ))}
                {selectedFile.notes && (
                  <div className="rounded-[9px] border border-[#E5E2DA] bg-[#FCFBF8] px-3 py-2">
                    <div className="text-[#918D84]">{pfUiT("ui.components.workspace.df6141c39a")}</div>
                    <div className="mt-0.5 leading-relaxed text-[#272622]">{selectedFile.notes}</div>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleDownload(selectedFile)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-[9px] border border-[#D9D5CC] bg-[#FCFBF8] px-3 py-2 font-semibold text-[#272622] hover:bg-[#EFEEE8]"
                  >
                    <Download className="h-3.5 w-3.5" />{pfUiT("ui.components.workspace.a364c47a55")}</button>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[9px] border border-[#D9D5CC] bg-[#FCFBF8] px-3 py-2 font-semibold text-[#272622] hover:bg-[#EFEEE8]">
                    <RotateCw className="h-3.5 w-3.5" />{pfUiT("ui.components.workspace.bc271c45dd")}<input
                      type="file"
                      className="sr-only"
                      onChange={(event) => handleReplaceFile(selectedFile, event.target.files?.[0])}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => handleDeleteFile(selectedFile.id)}
                    className="inline-flex items-center justify-center rounded-[9px] border border-[#E8C9C1] bg-[#FFF7F5] px-3 py-2 text-[#9A3D2F] hover:bg-[#F6EDEA]"
                    aria-label={pfUiT("ui.components.workspace.0ae1e2e938")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[220px] items-center justify-center rounded-[10px] border border-dashed border-[#D9D5CC] text-center text-[13px] text-[#6F6C65]">
                <div>
                  <Database className="mx-auto h-7 w-7 text-[#918D84]" />
                  <p className="mt-2">{pfUiT("ui.components.workspace.1905d49b93")}</p>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {uploadOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-[#272622]/35 p-4"
          style={{ zIndex: UI_LAYERS.modalBackdrop }}
        >
          <form
            onSubmit={handleUpload}
            className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-[14px] border border-[#D9D5CC] bg-[#FCFBF8] shadow-[0_30px_80px_rgba(39,38,34,0.22)]"
          >
            <div className="flex items-center justify-between border-b border-[#E5E2DA] px-5 py-4">
              <h3 className="text-[16px] font-semibold text-[#272622]">{pfUiT("ui.components.workspace.7d68aa1cd2")}</h3>
              <button type="button" onClick={() => setUploadOpen(false)} className="rounded-lg p-1.5 text-[#6F6C65] hover:bg-[#EFEEE8]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <label
                className="sm:col-span-2 rounded-[12px] border border-dashed border-[#D9D5CC] bg-[#F8F7F3] p-5 text-center text-[13px] text-[#6F6C65]"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  setUploadForm((current) => ({
                    ...current,
                    file: event.dataTransfer.files?.[0] || current.file
                  }));
                }}
              >
                <Upload className="mx-auto h-7 w-7 text-[#918D84]" />
                <span className="mt-2 block font-medium text-[#272622]">{uploadForm.file?.name || 'Choose a local pattern file'}</span>
                <input
                  type="file"
                  className="sr-only"
                  onChange={(event) => setUploadForm((current) => ({ ...current, file: event.target.files?.[0] || null }))}
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold text-[#6F6C65]">{pfUiT("ui.components.workspace.45308a57ff")}</span>
                <select value={uploadForm.destination} onChange={(event) => setUploadForm((current) => ({ ...current, destination: event.target.value }))} className="w-full rounded-[9px] border border-[#E5E2DA] bg-white px-3 py-2 text-[13px]">
                  <option value="MASTER">{pfUiT("ui.components.workspace.4e9bb758dc")}</option>
                  <option value="SIZE_SET">{pfUiT("ui.components.workspace.700cb1cd8b")}</option>
                  <option value="SUPPORTING">{pfUiT("ui.components.workspace.26c717824f")}</option>
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold text-[#6F6C65]">{pfUiT("ui.components.workspace.62cce1c1a3")}</span>
                <select value={uploadForm.sourceProvider} onChange={(event) => setUploadForm((current) => ({ ...current, sourceProvider: event.target.value }))} className="w-full rounded-[9px] border border-[#E5E2DA] bg-white px-3 py-2 text-[13px]">
                  {providerOptions.map((option) => (
                    <option key={option.code} value={option.code}>{t(option.labelKey)}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold text-[#6F6C65]">{pfUiT("ui.components.workspace.0050be9e51")}</span>
                <select value={uploadForm.technicalType} onChange={(event) => setUploadForm((current) => ({ ...current, technicalType: event.target.value }))} className="w-full rounded-[9px] border border-[#E5E2DA] bg-white px-3 py-2 text-[13px]">
                  {typeOptions.map((option) => (
                    <option key={option.code} value={option.code}>{t(option.labelKey)}</option>
                  ))}
                </select>
              </label>


              {uploadForm.destination === 'MASTER' && (
                <label className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-[#6F6C65]">{pfUiT("ui.components.workspace.536a080753")}</span>
                  <select value={uploadForm.masterRole} onChange={(event) => setUploadForm((current) => ({ ...current, masterRole: event.target.value }))} className="w-full rounded-[9px] border border-[#E5E2DA] bg-white px-3 py-2 text-[13px]">
                    <option value="AUTHORITATIVE">{pfUiT("ui.components.workspace.7ae090ae11")}</option>
                    <option value="SUPPORTING">{pfUiT("ui.components.workspace.1c5c4bda7d")}</option>
                  </select>
                </label>
              )}

              {uploadForm.destination === 'SIZE_SET' && (
                <>
                  <label className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-[#6F6C65]">{pfUiT("ui.components.workspace.deb6bb7041")}</span>
                    <input value={uploadForm.sizeSetName} onChange={(event) => setUploadForm((current) => ({ ...current, sizeSetName: event.target.value }))} className="w-full rounded-[9px] border border-[#E5E2DA] bg-white px-3 py-2 text-[13px]" />
                  </label>
                  <div className="sm:col-span-2">
                    <span className="text-[11px] font-semibold text-[#6F6C65]">{pfUiT("ui.components.workspace.ef540fde9a")}</span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 xl:mt-2 xl:gap-2">
                      {expectedSizes.map((size) => (
                        <label key={size} className="inline-flex items-center gap-1.5 rounded-full border border-[#D9D5CC] bg-[#F4F2ED] px-3 py-1.5 text-[12px]">
                          <input
                            type="checkbox"
                            checked={uploadForm.coveredSizes.includes(size)}
                            onChange={(event) => setUploadForm((current) => ({
                              ...current,
                              coveredSizes: event.target.checked
                                ? [...current.coveredSizes, size]
                                : current.coveredSizes.filter((item) => item !== size)
                            }))}
                          />
                          {size}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-[11px] font-semibold text-[#6F6C65]">{pfUiT("ui.components.workspace.df6141c39a")}</span>
                <textarea value={uploadForm.notes} onChange={(event) => setUploadForm((current) => ({ ...current, notes: event.target.value }))} rows={3} className="w-full rounded-[9px] border border-[#E5E2DA] bg-white px-3 py-2 text-[13px]" />
              </label>

              {uploadError && (
                <div className="sm:col-span-2 rounded-[10px] border border-[#E8C9C1] bg-[#FFF7F5] px-3 py-2 text-[12px] text-[#9A3D2F]">
                  {uploadError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#E5E2DA] px-5 py-4">
              <button type="button" onClick={() => setUploadOpen(false)} className="rounded-[9px] border border-[#D9D5CC] px-3.5 py-2 text-[12px] font-semibold text-[#4A4741] hover:bg-[#EFEEE8]">{pfUiT("ui.components.workspace.3e708f4001")}</button>
              <button type="submit" className="rounded-[9px] bg-[#272622] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#3A3934]">{pfUiT("ui.components.workspace.9ddda22302")}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function MeasurementChartModule({
  metadata,
  node,
  variant,
  style,
  currentUser,
  onChange,
  t
}) {
  const chart = useMemo(
    () => normalizeMeasurementChartValues(
      node.values || {},
      variant?.values || {},
      metadata,
      style?.values || {}
    ),
    [metadata, node.values, style?.values, variant?.values]
  );
  const systems = chart.sizingSystems?.length ? chart.sizingSystems : getMeasurementSizeSystems(metadata);
  const displayLabels = getDisplaySizeReferences(chart, chart.displaySystem);
  const baseReferenceSize = resolveBaseSizeReference(
    chart,
    chart.displaySystem,
    variant?.values?.['variant.base_reference_size']
  );
  const actor = useMemo(
    () => resolveWorkspaceActor(currentUser),
    [currentUser]
  );
  const chartStatus = normalizeApprovalStatus(
    chart.status || chart.workflow?.status
  );
  const reviewLocked = chartStatus === 'IN_REVIEW';
  const [newPomName, setNewPomName] = useState('');
  const [activeChartTab, setActiveChartTab] = useState('measurements');
  const [activeMeasurementView, setActiveMeasurementView] = useState('body');
  const [fitProfileDraft, setFitProfileDraft] = useState(() => cloneValue(chart.fitProfile || {}));
  const [fitMessage, setFitMessage] = useState('');
  const [garmentDraft, setGarmentDraft] = useState(() => cloneValue(chart.garmentMeasurements || {}));
  const [garmentMessage, setGarmentMessage] = useState('');

  const fitProfileSignature = useMemo(
    () => JSON.stringify(chart.fitProfile || {}),
    [chart.fitProfile]
  );
  const garmentMeasurementsSignature = useMemo(
    () => JSON.stringify(chart.garmentMeasurements || {}),
    [chart.garmentMeasurements]
  );

  useEffect(() => {
    setFitProfileDraft(cloneValue(chart.fitProfile || {}));
    setFitMessage('');
  }, [node.id, chart.revisionNumber, fitProfileSignature]);

  useEffect(() => {
    setGarmentDraft(cloneValue(chart.garmentMeasurements || {}));
    setGarmentMessage('');
  }, [node.id, chart.revisionNumber, garmentMeasurementsSignature]);

  const persistMeasurementChart = (
    nextValues,
    {
      governed = false,
      revisionReason = 'Measurement Chart technical revision'
    } = {}
  ) => {
    if (governed && reviewLocked) {
      window.showToast?.(
        'This Fit Specification is in review. Return it to Draft before editing technical data.',
        'warning'
      );
      return false;
    }

    const candidate = governed
      ? {
          ...nextValues,
          status: 'DRAFT',
          workflow: {
            ...(chart.workflow || {}),
            ...(nextValues.workflow || {}),
            status: 'DRAFT',
            hasUnreleasedChanges: true,
            pendingRevisionReason: revisionReason,
            basedOnRevisionNumber: chart.revisionNumber,
            basedOnRevisionLabel: chart.revisionLabel
          }
        }
      : nextValues;

    const normalized = normalizeMeasurementChartValues(
      candidate,
      variant?.values || {},
      metadata,
      style?.values || {}
    );

    onChange('__replaceValues', null, node.id, normalized);
    return true;
  };

  const updateDisplaySystem = (displaySystem) => {
    const saved = persistMeasurementChart({
      ...chart,
      displaySystem
    }, {
      governed: true,
      revisionReason: 'Default display size system revision'
    });

    if (saved && variant?.id) {
      onChange('variant.size_system', displaySystem, variant.id);
    }
  };

  const updateBaseSize = (baseSizeId) => {
    const baseSize = chart.sizes.find((size) => size.id === baseSizeId) || chart.sizes[0];
    const saved = persistMeasurementChart({
      ...chart,
      baseSizeId: baseSize?.id || ''
    }, {
      governed: true,
      revisionReason: 'Base reference size revision'
    });

    if (saved && variant?.id && baseSize) {
      onChange('variant.base_reference_size', getPreferredSizeReference(baseSize, chart.displaySystem), variant.id);
    }
  };

  const updateUnit = (unit) => {
    const convertedChart = convertMeasurementChartUnitValues(
      chart,
      unit
    );

    persistMeasurementChart(convertedChart, {
      governed: true,
      revisionReason: `Measurement unit conversion ${chart.unit} → ${unit}`
    });
  };

  const updateSizeReference = (sizeId, systemCode, value) => {
    persistMeasurementChart({
      ...chart,
      sizes: chart.sizes.map((size) => (
        size.id === sizeId
          ? {
              ...size,
              references: {
                ...(size.references || {}),
                [systemCode]: value
              }
            }
          : size
      ))
    }, {
      governed: true,
      revisionReason: 'Size reference revision'
    });
  };

  const addCanonicalSize = () => {
    const nextIndex = chart.sizes.length + 1;
    const nextId = `size-${String(nextIndex).padStart(2, '0')}`;
    const nextSize = {
      id: nextId,
      sortOrder: nextIndex,
      references: {
        ALPHA: `SIZE-${String(nextIndex).padStart(2, '0')}`
      }
    };

    persistMeasurementChart({
      ...chart,
      sizes: [...chart.sizes, nextSize],
      measurements: chart.measurements.map((row) => ({
        ...row,
        values: {
          ...(row.values || {}),
          [nextId]: ''
        }
      }))
    }, {
      governed: true,
      revisionReason: 'Canonical size revision'
    });
  };

  const removeCanonicalSize = (sizeId) => {
    if (chart.sizes.length <= 1) return;

    const nextSizes = chart.sizes.filter((size) => size.id !== sizeId);
    const nextMeasurements = chart.measurements.map((row) => {
      const nextValues = { ...(row.values || {}) };
      delete nextValues[sizeId];
      return {
        ...row,
        values: nextValues
      };
    });

    persistMeasurementChart({
      ...chart,
      sizes: nextSizes,
      baseSizeId: chart.baseSizeId === sizeId ? nextSizes[0]?.id : chart.baseSizeId,
      measurements: nextMeasurements
    }, {
      governed: true,
      revisionReason: 'Canonical size revision'
    });
  };

  const updateMeasurementValue = (rowId, sizeId, value) => {
    persistMeasurementChart({
      ...chart,
      measurements: chart.measurements.map((row) => (
        row.id === rowId
          ? {
              ...row,
              values: {
                ...(row.values || {}),
                [sizeId]: value
              }
            }
          : row
      ))
    }, {
      governed: true,
      revisionReason: 'Body measurement revision'
    });
  };

  const updateMeasurementLabel = (rowId, value) => {
    persistMeasurementChart({
      ...chart,
      measurements: chart.measurements.map((row) => (
        row.id === rowId
          ? {
              ...row,
              label: value
            }
          : row
      ))
    }, {
      governed: true,
      revisionReason: 'Measurement label revision'
    });
  };

  const addMeasurementRow = () => {
    const label = newPomName.trim();
    if (!label) return;

    const nextIndex = chart.measurements.length + 1;
    persistMeasurementChart({
      ...chart,
      measurements: [
        ...chart.measurements,
        {
          id: `pom-${slugify(label)}-${Date.now()}`,
          code: `POM-${String(nextIndex).padStart(2, '0')}`,
          label,
          values: chart.sizes.reduce((result, size) => ({
            ...result,
            [size.id]: ''
          }), {})
        }
      ]
    }, {
      governed: true,
      revisionReason: 'Measurement point revision'
    });
    setNewPomName('');
  };

  const removeMeasurementRow = (rowId) => {
    persistMeasurementChart({
      ...chart,
      measurements: chart.measurements.filter((row) => row.id !== rowId)
    }, {
      governed: true,
      revisionReason: 'Measurement point revision'
    });
  };

  const garmentMeasurementRules = (chart.fitProfile?.rules || [])
    .filter((rule) => rule?.measurementCode);

  const garmentMeasurementsDirty =
    JSON.stringify(garmentDraft || {}) !==
    JSON.stringify(chart.garmentMeasurements || {});

  const setGarmentMeasurementValue = (measurementCode, sizeId, value) => {
    setGarmentDraft((current) => ({
      ...(current || {}),
      [measurementCode]: {
        ...(current?.[measurementCode] || {}),
        [sizeId]: value
      }
    }));
    setGarmentMessage('');
  };

  const getBodyMeasurementRow = (measurementCode) =>
    chart.measurements.find((row) => {
      const token = String(row.label || row.code || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_');
      return token === measurementCode || token.startsWith(`${measurementCode}_`);
    }) || null;

  const saveGarmentMeasurementRevision = () => {
    if (!garmentMeasurementsDirty) {
      setGarmentMessage('No finished-garment measurement changes to save.');
      return;
    }

    const nextChart = {
      ...chart,
      garmentMeasurements: garmentDraft,
    };

    const saved = persistMeasurementChart(nextChart, {
      governed: true,
      revisionReason: 'Finished garment measurements updated'
    });
    if (saved) {
      setGarmentMessage('Finished garment measurements saved as unreleased technical changes.');
    }
  };

  const fitPriorityOptions = metadata.dropdowns?.FIT_PRIORITY || [];
  const pendingFitProposals = (chart.fitProfile?.proposals || []).filter(
    (proposal) => proposal.status === 'PENDING'
  );
  const standardFitCategoryLabel = getDropdownLabel(
    metadata,
    'STANDARD_FIT_CATEGORY',
    chart.fitProfile?.standardCategory,
    t
  ) || chart.fitProfile?.standardCategory || '-';
  const silhouetteLabel = getDropdownLabel(
    metadata,
    'FIT_SILHOUETTE',
    chart.fitProfile?.silhouette,
    t
  ) || chart.fitProfile?.silhouette || '-';

  const setFitRuleField = (measurementCode, field, value) => {
    setFitProfileDraft((current) => ({
      ...current,
      rules: (current.rules || []).map((rule) => (
        rule.measurementCode === measurementCode
          ? {
              ...rule,
              [field]: value,
              source: 'DESIGNER_OVERRIDE',
              sourceDetail: actor.login || actor.name || 'Designer'
            }
          : rule
      ))
    }));
    setFitMessage('');
  };

  const fitTechnicalDraft = {
    ...(fitProfileDraft || {}),
    proposals: chart.fitProfile?.proposals || []
  };
  const fitProfileDirty = JSON.stringify(fitTechnicalDraft?.rules || []) !== JSON.stringify(chart.fitProfile?.rules || []);

  const saveFitProfileRevision = () => {
    if (!fitProfileDirty) {
      setFitMessage('No Fit Profile changes to save.');
      return;
    }

    const now = getNowIso();
    const nextChart = {
      ...chart,
      fitProfile: {
        ...fitTechnicalDraft,
        updatedAt: now,
        updatedBy: {
          id: actor.id,
          name: actor.name,
          login: actor.login
        }
      }
    };

    const saved = persistMeasurementChart(nextChart, {
      governed: true,
      revisionReason: 'Designer Fit Profile updated'
    });
    if (saved) {
      setFitMessage('Fit Profile saved as unreleased technical changes.');
    }
  };

  const decideFitProposal = (proposalId, decision) => {
    const proposal = (chart.fitProfile?.proposals || []).find((item) => item.id === proposalId);
    if (!proposal) return;

    const now = getNowIso();
    const decisionMeta = {
      status: decision,
      decidedAt: now,
      decidedBy: {
        id: actor.id,
        name: actor.name,
        login: actor.login
      }
    };

    if (decision === 'REJECTED') {
      persistMeasurementChart({
        ...chart,
        fitProfile: {
          ...chart.fitProfile,
          proposals: (chart.fitProfile?.proposals || []).map((item) => (
            item.id === proposalId
              ? { ...item, ...decisionMeta }
              : item
          ))
        }
      });
      setFitMessage('Fit-session proposal rejected. The technical Fit Profile was not changed.');
      return;
    }

    const nextRules = (chart.fitProfile?.rules || []).map((rule) => {
      if (rule.measurementCode !== proposal.measurementCode) return rule;

      return {
        ...rule,
        priority: proposal.to?.priority || rule.priority,
        minimumEase: proposal.to?.minimumEase ?? rule.minimumEase ?? '',
        targetEase: proposal.to?.targetEase ?? rule.targetEase ?? '',
        maximumPreferredEase:
          proposal.to?.maximumPreferredEase ??
          rule.maximumPreferredEase ??
          '',
        source: 'DESIGNER_OVERRIDE',
        sourceDetail: `Fit session ${proposal.fitSessionId || ''}`.trim(),
        overrideReason: proposal.reason || rule.overrideReason || '',
        evidenceIds: Array.from(new Set([
          ...(rule.evidenceIds || []),
          ...(proposal.fitSessionId ? [proposal.fitSessionId] : [])
        ]))
      };
    });

    const nextProposals = (chart.fitProfile?.proposals || []).map((item) => (
      item.id === proposalId
        ? { ...item, ...decisionMeta }
        : item
    ));

    const nextChart = {
      ...chart,
      fitProfile: {
        ...chart.fitProfile,
        rules: nextRules,
        proposals: nextProposals,
        updatedAt: now,
        updatedBy: decisionMeta.decidedBy
      }
    };

    const saved = persistMeasurementChart(nextChart, {
      governed: true,
      revisionReason: `Accepted Fit Session proposal ${proposal.fitSessionId || proposal.id}`
    });
    if (saved) {
      setFitMessage('Fit-session proposal accepted as an unreleased technical change.');
    }
  };

  const sourceLabel = (source) => ({
    STANDARD_CATEGORY: 'Standard category',
    SILHOUETTE_MODIFIER: 'Silhouette modifier',
    DESIGNER_OVERRIDE: 'Designer override'
  }[source] || source || 'Standard');

  const tabs = [
    { code: 'measurements', label: pfUiT('ui.workspace.measurementTabs.measurements', {}, 'Measurements') },
    { code: 'fitProfile', label: pfUiT('ui.workspace.measurementTabs.fitProfile', {}, 'Fit Profile') },
    { code: 'history', label: pfUiT('ui.workspace.measurementTabs.history', {}, 'Revision History') }
  ];
  const measurementViews = [
    { code: 'body', labelKey: 'ui.workspace.measurementViews.body' },
    { code: 'garment', labelKey: 'ui.workspace.measurementViews.garment' },
    { code: 'compare', labelKey: 'ui.workspace.measurementViews.compare' }
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-[12px] border border-[#E5E2DA] bg-[#FCFBF8] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-[16px] font-semibold text-[#272622]">{pfUiT("ui.components.workspace.795938fa89")}</h3>
            <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-[#6F6C65]">{pfUiT("ui.components.workspace.3b4e3488d0")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
              chartStatus === 'APPROVED'
                ? 'border-[#BFD2C2] bg-[#EDF5EE] text-[#4F7A58]'
                : chartStatus === 'IN_REVIEW'
                  ? 'border-[#E4D1A6] bg-[#FFF8E8] text-[#8D641E]'
                  : 'border-[#DCC7B4] bg-[#FBF5ED] text-[#7D5C46]'
            }`}>
              {chartStatus === 'IN_REVIEW' ? 'In review' : chartStatus === 'APPROVED' ? 'Approved' : 'Draft'}
            </span>
            <span className="rounded-full border border-[#D9D5CC] bg-[#F4F2ED] px-3 py-1.5 text-[11px] font-semibold text-[#6F6C65]">
              {chart.revisionLabel || `V${chart.revisionNumber || 1}`}
            </span>
            <span className="rounded-full border border-[#D9D5CC] bg-[#F4F2ED] px-3 py-1.5 text-[11px] font-semibold text-[#6F6C65]">
              Base {baseReferenceSize || '-'}
            </span>
            {pendingFitProposals.length > 0 && (
              <span className="rounded-full border border-[#D9B97A] bg-[#FFF7E7] px-3 py-1.5 text-[11px] font-semibold text-[#8A5A18]">
                {pendingFitProposals.length} fit proposal{pendingFitProposals.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1 rounded-[10px] border border-[#E5E2DA] bg-white p-1">
          {tabs.map((tab) => (
            <button
              key={tab.code}
              type="button"
              onClick={() => setActiveChartTab(tab.code)}
              className={`rounded-[8px] px-3.5 py-2 text-[12px] font-semibold transition ${
                activeChartTab === tab.code
                  ? 'bg-[#272622] text-white'
                  : 'text-[#6F6C65] hover:bg-[#F4F2ED] hover:text-[#272622]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <div className={`rounded-[10px] border px-3.5 py-2.5 text-[11px] leading-relaxed ${
        chartStatus === 'APPROVED'
          ? 'border-[#C9DDCC] bg-[#F0F7F1] text-[#4D7656]'
          : chartStatus === 'IN_REVIEW'
            ? 'border-[#E4D1A6] bg-[#FFF8E8] text-[#7D5B20]'
            : 'border-[#DCC7B4] bg-[#FBF5ED] text-[#7D5C46]'
      }`}>
        {chartStatus === 'APPROVED'
          ? `${chart.revisionLabel} is approved. Editing governed fit data creates unreleased Draft changes; a new technical revision is created only when those changes are explicitly approved.`
          : chartStatus === 'IN_REVIEW'
            ? `${chart.revisionLabel} is in review. Technical fields are locked until the Fit Specification is approved or returned to Draft from Approval & Release.`
            : `${chart.revisionLabel} is the working Draft. Submit the Fit Specification through Approval & Release when body measurements, finished garment dimensions and fit rules are ready.`}
      </div>

      {activeChartTab === 'measurements' && (
        <div className="flex flex-wrap gap-1 rounded-[10px] border border-[#E5E2DA] bg-[#FCFBF8] p-1">
          {measurementViews.map((view) => (
            <button
              key={view.code}
              type="button"
              onClick={() => setActiveMeasurementView(view.code)}
              className={`rounded-[8px] px-3.5 py-2 text-[12px] font-semibold ${activeMeasurementView === view.code ? 'bg-[#272622] text-white' : 'text-[#6F6C65] hover:bg-white'}`}
            >{pfUiT(view.labelKey)}</button>
          ))}
        </div>
      )}

      <div className={reviewLocked && activeChartTab !== 'history' ? 'pointer-events-none opacity-60' : ''}>
      {activeChartTab === 'measurements' && activeMeasurementView === 'body' && (
        <>
          <section className="rounded-[12px] border border-[#E5E2DA] bg-[#FCFBF8] p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6F6C65]">{pfUiT("ui.components.workspace.0f31364f74")}</span>
                <select
                  value={chart.displaySystem}
                  onChange={(event) => updateDisplaySystem(event.target.value)}
                  className="w-full rounded-[9px] border border-[#E5E2DA] bg-white px-3 py-2 text-[13px]"
                >
                  {systems.map((system) => (
                    <option key={system.code} value={system.code}>{system.label}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6F6C65]">{pfUiT("ui.components.workspace.57bf8d11d2")}</span>
                <select
                  value={chart.baseSizeId}
                  onChange={(event) => updateBaseSize(event.target.value)}
                  className="w-full rounded-[9px] border border-[#E5E2DA] bg-white px-3 py-2 text-[13px]"
                >
                  {chart.sizes.map((size) => (
                    <option key={size.id} value={size.id}>
                      {getPreferredSizeReference(size, chart.displaySystem) || size.id}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6F6C65]">{pfUiT("ui.components.workspace.08606d976f")}</span>
                <select
                  value={chart.unit}
                  onChange={(event) => updateUnit(event.target.value)}
                  className="w-full rounded-[9px] border border-[#E5E2DA] bg-white px-3 py-2 text-[13px]"
                >
                  <option value="cm">cm</option>
                  <option value="in">in</option>
                </select>
              </label>
            </div>

            <div className="mt-4 rounded-[10px] border border-[#E5E2DA] bg-white">
              <div className="flex flex-col gap-2 border-b border-[#E5E2DA] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-[14px] font-semibold text-[#272622]">{pfUiT("ui.components.workspace.5679ff31c4")}</h4>
                  <p className="mt-1 text-[12px] text-[#6F6C65]">{pfUiT("ui.components.workspace.5d5641e849")}</p>
                </div>
                <button
                  type="button"
                  onClick={addCanonicalSize}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-[9px] border border-[#D9D5CC] bg-[#FCFBF8] px-3.5 text-[12px] font-semibold text-[#272622] hover:bg-[#F4F2ED]"
                >
                  <Plus className="h-4 w-4" />{pfUiT("ui.components.workspace.640292792c")}</button>
              </div>
              <div className="overflow-auto">
                <table className="min-w-full text-left text-[12px]">
                  <thead className="border-b border-[#E5E2DA] text-[11px] uppercase tracking-[0.12em] text-[#918D84]">
                    <tr>
                      <th className="min-w-[120px] px-4 py-3 font-semibold">{pfUiT("ui.components.workspace.aeae96b030")}</th>
                      {systems.map((system) => (
                        <th key={system.code} className="min-w-[115px] px-3 py-3 font-semibold">{system.label}</th>
                      ))}
                      <th className="w-16 px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {chart.sizes.map((size, index) => (
                      <tr key={size.id} className="border-b border-[#EEEAE2]">
                        <td className="px-4 py-2">
                          <div className="font-mono text-[11px] font-semibold text-[#272622]">{size.id}</div>
                          <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-[#918D84]">Size {index + 1}</div>
                        </td>
                        {systems.map((system) => (
                          <td key={`${size.id}-${system.code}`} className="px-3 py-2">
                            <input
                              value={size.references?.[system.code] || ''}
                              onChange={(event) => updateSizeReference(size.id, system.code, event.target.value)}
                              className="w-full rounded-[8px] border border-[#E5E2DA] bg-white px-2.5 py-1.5 text-center text-[12px] text-[#272622]"
                              placeholder={system.code}
                            />
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeCanonicalSize(size.id)}
                            disabled={chart.sizes.length <= 1}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#E8C9C1] bg-[#FFF7F5] text-[#9A3D2F] hover:bg-[#F6EDEA] disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={pfUiT("ui.components.workspace.ec0e104be4")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="rounded-[12px] border border-[#E5E2DA] bg-[#FCFBF8]">
            <div className="flex flex-col gap-3 border-b border-[#E5E2DA] px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-[#272622]">{pfUiT("ui.components.workspace.53a9e5104f")}</h3>
                <p className="mt-1 text-[12px] text-[#6F6C65]">{pfUiT("ui.components.workspace.053f9140de")}</p>
              </div>
              <div className="flex gap-2">
                <input
                  value={newPomName}
                  onChange={(event) => setNewPomName(event.target.value)}
                  className="h-9 w-48 rounded-[9px] border border-[#E5E2DA] bg-white px-3 text-[12px]"
                  placeholder={pfUiT("ui.components.workspace.92c919dac3")}
                />
                <button
                  type="button"
                  onClick={addMeasurementRow}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-[9px] bg-[#272622] px-3.5 text-[12px] font-semibold text-white hover:bg-[#3A3934]"
                >
                  <Plus className="h-4 w-4" />{pfUiT("ui.components.workspace.a144aff3fb")}</button>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="min-w-full text-left text-[12px]">
                <thead className="border-b border-[#E5E2DA] text-[11px] uppercase tracking-[0.12em] text-[#918D84]">
                  <tr>
                    <th className="min-w-[190px] px-4 py-3 font-semibold">{pfUiT("ui.components.workspace.c5b8c54ffd")}</th>
                    {chart.sizes.map((size, index) => (
                      <th key={size.id} className="min-w-[105px] px-3 py-3 text-center font-semibold">
                        <span className="block text-[#272622]">
                          {displayLabels[index] || getPreferredSizeReference(size, chart.displaySystem) || size.id}
                        </span>
                        <span className="mt-0.5 block text-[9px] normal-case tracking-normal text-[#918D84]">{size.id}</span>
                      </th>
                    ))}
                    <th className="w-16 px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {chart.measurements.map((row) => (
                    <tr key={row.id} className="border-b border-[#EEEAE2]">
                      <td className="px-4 py-2">
                        <input
                          value={row.label || ''}
                          onChange={(event) => updateMeasurementLabel(row.id, event.target.value)}
                          className="w-full rounded-[8px] border border-[#E5E2DA] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#272622]"
                        />
                        <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#918D84]">{row.code}</div>
                      </td>
                      {chart.sizes.map((size) => (
                        <td key={`${row.id}-${size.id}`} className="px-3 py-2">
                          <input
                            value={row.values?.[size.id] || ''}
                            onChange={(event) => updateMeasurementValue(row.id, size.id, event.target.value)}
                            className="w-full rounded-[8px] border border-[#E5E2DA] bg-white px-2.5 py-1.5 text-center text-[12px] text-[#272622]"
                            inputMode="decimal"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeMeasurementRow(row.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#E8C9C1] bg-[#FFF7F5] text-[#9A3D2F] hover:bg-[#F6EDEA]"
                          aria-label={pfUiT("ui.components.workspace.bb8e1df905")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {chart.measurements.length === 0 && (
                    <tr>
                      <td colSpan={chart.sizes.length + 2} className="px-4 py-8 text-center text-[13px] text-[#6F6C65]">{pfUiT("ui.components.workspace.f900222939")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {activeChartTab === 'measurements' && activeMeasurementView === 'garment' && (
        <div className="space-y-3">
          <section className="rounded-[12px] border border-[#E5E2DA] bg-[#FCFBF8] p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-[#272622]">{pfUiT("ui.components.workspace.18f47dc285")}</h3>
                <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-[#6F6C65]">
                  Record the actual garment dimension for each canonical size. Find My Size uses these values with the Fit Profile ease thresholds; critical areas can then be rejected on physical clearance rather than body-chart proximity alone.
                </p>
              </div>
              <button
                type="button"
                onClick={saveGarmentMeasurementRevision}
                disabled={!garmentMeasurementsDirty}
                className="inline-flex h-9 items-center justify-center rounded-[9px] bg-[#272622] px-3.5 text-[12px] font-semibold text-white hover:bg-[#3A3934] disabled:cursor-not-allowed disabled:opacity-35"
              >{pfUiT("ui.components.workspace.381b967aea")}</button>
            </div>
            {garmentMessage && (
              <div className="mt-2 text-[11px] font-semibold text-[#8A633E]">{garmentMessage}</div>
            )}
          </section>

          <section className="overflow-hidden rounded-[12px] border border-[#E5E2DA] bg-white">
            <div className="overflow-auto">
              <table className="min-w-[900px] w-full text-left text-[12px]">
                <thead className="border-b border-[#E5E2DA] bg-[#FCFBF8] text-[10px] uppercase tracking-[0.12em] text-[#918D84]">
                  <tr>
                    <th className="sticky left-0 z-10 min-w-[190px] bg-[#FCFBF8] px-4 py-3 font-semibold">{pfUiT("ui.components.workspace.41bfa0a9b0")}</th>
                    {chart.sizes.map((size) => (
                      <th key={size.id} className="min-w-[130px] px-3 py-3 text-center font-semibold">
                        {getPreferredSizeReference(size, chart.displaySystem) || size.id}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {garmentMeasurementRules.map((rule) => {
                    const bodyRow = getBodyMeasurementRow(rule.measurementCode);
                    return (
                      <tr key={rule.measurementCode} className="border-b border-[#EEEAE2] align-top">
                        <td className="sticky left-0 z-10 bg-white px-4 py-3">
                          <div className="font-semibold text-[#272622]">{getFitBodyAreaLabel(rule.measurementCode, metadata)}</div>
                          <div className="mt-1 text-[10px] text-[#918D84]">
                            {rule.priority || 'SECONDARY'}
                            {rule.targetEase !== '' && rule.targetEase !== undefined ? ` · target ${rule.targetEase}${chart.unit}` : ''}
                          </div>
                        </td>
                        {chart.sizes.map((size) => {
                          const value = garmentDraft?.[rule.measurementCode]?.[size.id] ?? '';
                          const bodyAnchor = Number(bodyRow?.values?.[size.id]);
                          const garmentValue = Number(value);
                          const ease = Number.isFinite(bodyAnchor) && Number.isFinite(garmentValue)
                            ? garmentValue - bodyAnchor
                            : null;
                          return (
                            <td key={`${rule.measurementCode}-${size.id}`} className="px-3 py-3">
                              <input
                                value={value}
                                onChange={(event) => setGarmentMeasurementValue(rule.measurementCode, size.id, event.target.value)}
                                inputMode="decimal"
                                className="h-9 w-full rounded-[8px] border border-[#E5E2DA] bg-[#FCFBF8] px-2.5 text-center text-[12px] text-[#272622]"
                                placeholder="—"
                              />
                              <div className="mt-1 text-center text-[9px] text-[#918D84]">
                                {ease === null ? `garment ${chart.unit}` : `ease ${ease >= 0 ? '+' : ''}${ease.toFixed(1)} ${chart.unit}`}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {garmentMeasurementRules.length === 0 && (
                    <tr>
                      <td colSpan={chart.sizes.length + 1} className="px-4 py-8 text-center text-[12px] text-[#6F6C65]">{pfUiT("ui.components.workspace.debb861f75")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {activeChartTab === 'measurements' && activeMeasurementView === 'compare' && (
        <section className="overflow-hidden rounded-[12px] border border-[#E5E2DA] bg-white">
          <div className="border-b border-[#E5E2DA] bg-[#FCFBF8] px-4 py-3">
            <h3 className="text-[15px] font-semibold text-[#272622]">{pfUiT('ui.workspace.measurementCompare.title')}</h3>
            <p className="mt-1 text-[12px] text-[#6F6C65]">{pfUiT('ui.workspace.measurementCompare.description')}</p>
          </div>
          <div className="overflow-auto">
            <table className="min-w-[900px] w-full text-left text-[12px]">
              <thead className="border-b border-[#E5E2DA] bg-[#FCFBF8] text-[10px] uppercase tracking-[0.12em] text-[#918D84]">
                <tr>
                  <th className="min-w-[190px] px-4 py-3 font-semibold">{pfUiT('ui.workspace.measurementCompare.measurement')}</th>
                  {chart.sizes.map((size) => (
                    <th key={size.id} className="min-w-[150px] px-3 py-3 text-center font-semibold">{getPreferredSizeReference(size, chart.displaySystem) || size.id}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {garmentMeasurementRules.map((rule) => {
                  const bodyRow = getBodyMeasurementRow(rule.measurementCode);
                  return (
                    <tr key={rule.measurementCode} className="border-b border-[#EEEAE2]">
                      <td className="px-4 py-3 font-semibold text-[#272622]">{getFitBodyAreaLabel(rule.measurementCode, metadata)}</td>
                      {chart.sizes.map((size) => {
                        const bodyRaw = bodyRow?.values?.[size.id];
                        const garmentRaw = garmentDraft?.[rule.measurementCode]?.[size.id];
                        const bodyValue = bodyRaw === '' || bodyRaw === null || bodyRaw === undefined ? NaN : Number(bodyRaw);
                        const garmentValue = garmentRaw === '' || garmentRaw === null || garmentRaw === undefined ? NaN : Number(garmentRaw);
                        const comparable = Number.isFinite(bodyValue) && Number.isFinite(garmentValue);
                        const ease = comparable ? garmentValue - bodyValue : null;
                        return (
                          <td key={`${rule.measurementCode}-${size.id}-compare`} className="px-3 py-3 text-center">
                            <div className="text-[10px] text-[#6F6C65]">Body {Number.isFinite(bodyValue) ? `${bodyValue} ${chart.unit}` : '—'}</div>
                            <div className="text-[10px] text-[#6F6C65]">Garment {Number.isFinite(garmentValue) ? `${garmentValue} ${chart.unit}` : '—'}</div>
                            <div className="mt-1 font-semibold text-[#272622]">Ease {ease === null ? '—' : `${ease >= 0 ? '+' : ''}${ease.toFixed(1)} ${chart.unit}`}</div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeChartTab === 'fitProfile' && (
        <div className="space-y-4">
          <section className="rounded-[12px] border border-[#E5E2DA] bg-[#FCFBF8] p-4">
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-[10px] border border-[#E5E2DA] bg-white p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#918D84]">{pfUiT("ui.components.workspace.9cbd2c7bfd")}</div>
                <div className="mt-1 text-[14px] font-semibold text-[#272622]">{standardFitCategoryLabel}</div>
                <div className="mt-1 text-[11px] leading-relaxed text-[#6F6C65]">{pfUiT("ui.components.workspace.c3c69b9f9e")}</div>
              </div>
              <div className="rounded-[10px] border border-[#E5E2DA] bg-white p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#918D84]">{pfUiT("ui.components.workspace.466d498736")}</div>
                <div className="mt-1 text-[14px] font-semibold text-[#272622]">{silhouetteLabel}</div>
                <div className="mt-1 text-[11px] leading-relaxed text-[#6F6C65]">{pfUiT("ui.components.workspace.a65065fff8")}</div>
              </div>
              <div className="rounded-[10px] border border-[#E5E2DA] bg-white p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#918D84]">{pfUiT("ui.components.workspace.ed2ec198ab")}</div>
                <div className="mt-1 text-[14px] font-semibold text-[#272622]">{chart.fitProfile?.baseline?.label || 'Industry standard baseline'}</div>
                <div className="mt-1 text-[11px] leading-relaxed text-[#6F6C65]">{pfUiT("ui.components.workspace.a14fafa62b")}</div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[12px] border border-[#E5E2DA] bg-[#FCFBF8]">
            <div className="border-b border-[#E5E2DA] px-4 py-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#272622]">{pfUiT("ui.components.workspace.77d6291449")}</h3>
                  <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-[#6F6C65]">{pfUiT("ui.components.workspace.0d4e5ceb97")}</p>
                </div>
                <button
                  type="button"
                  onClick={saveFitProfileRevision}
                  disabled={!fitProfileDirty}
                  className="inline-flex h-9 items-center justify-center rounded-[9px] bg-[#272622] px-3.5 text-[12px] font-semibold text-white hover:bg-[#3A3934] disabled:cursor-not-allowed disabled:opacity-35"
                >{pfUiT("ui.components.workspace.56c6b2ea80")}</button>
              </div>
              {fitMessage && (
                <div className="mt-2 text-[11px] font-semibold text-[#8A633E]">{fitMessage}</div>
              )}
            </div>

            <div className="overflow-auto">
              <table className="min-w-[980px] w-full text-left text-[12px]">
                <thead className="border-b border-[#E5E2DA] bg-white text-[10px] uppercase tracking-[0.12em] text-[#918D84]">
                  <tr>
                    <th className="min-w-[150px] px-4 py-3 font-semibold">{pfUiT("ui.components.workspace.5e8fceeed1")}</th>
                    <th className="min-w-[145px] px-3 py-3 font-semibold">{pfUiT("ui.components.workspace.5988a81f87")}</th>
                    <th className="min-w-[120px] px-3 py-3 font-semibold">{pfUiT("ui.components.workspace.f32ac791ca")}</th>
                    <th className="min-w-[120px] px-3 py-3 font-semibold">{pfUiT("ui.components.workspace.052d457e9e")}</th>
                    <th className="min-w-[135px] px-3 py-3 font-semibold">{pfUiT("ui.components.workspace.9860542b3e")}</th>
                    <th className="min-w-[150px] px-3 py-3 font-semibold">{pfUiT("ui.components.workspace.450cc633f1")}</th>
                    <th className="min-w-[230px] px-3 py-3 font-semibold">{pfUiT("ui.components.workspace.9aa431fd07")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(fitProfileDraft?.rules || []).map((rule) => (
                    <tr key={rule.measurementCode} className="border-b border-[#EEEAE2] align-top">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#272622]">{getFitBodyAreaLabel(rule.measurementCode, metadata)}</div>
                        <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#918D84]">{rule.measurementCode}</div>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          value={rule.priority || 'SECONDARY'}
                          onChange={(event) => setFitRuleField(rule.measurementCode, 'priority', event.target.value)}
                          className="h-9 w-full rounded-[8px] border border-[#E5E2DA] bg-white px-2.5 text-[12px] text-[#272622]"
                        >
                          {fitPriorityOptions.map((option) => (
                            <option key={option.code} value={option.code}>{option.eipV1Value || option.code}</option>
                          ))}
                        </select>
                      </td>
                      {['minimumEase', 'targetEase', 'maximumPreferredEase'].map((field) => (
                        <td key={`${rule.measurementCode}-${field}`} className="px-3 py-3">
                          <div className="relative">
                            <input
                              value={rule[field] ?? ''}
                              onChange={(event) => setFitRuleField(rule.measurementCode, field, event.target.value)}
                              inputMode="decimal"
                              className="h-9 w-full rounded-[8px] border border-[#E5E2DA] bg-white px-2.5 pr-9 text-[12px] text-[#272622]"
                              placeholder="—"
                            />
                            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#918D84]">{chart.unit}</span>
                          </div>
                        </td>
                      ))}
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] ${
                          rule.source === 'DESIGNER_OVERRIDE'
                            ? 'border-[#D9B97A] bg-[#FFF7E7] text-[#8A5A18]'
                            : 'border-[#D9D5CC] bg-white text-[#6F6C65]'
                        }`}>
                          {sourceLabel(rule.source)}
                        </span>
                        {rule.evidenceIds?.length > 0 && (
                          <div className="mt-1 text-[10px] text-[#918D84]">{rule.evidenceIds.length} fit-session evidence link{rule.evidenceIds.length === 1 ? '' : 's'}</div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <textarea
                          value={rule.overrideReason || ''}
                          onChange={(event) => setFitRuleField(rule.measurementCode, 'overrideReason', event.target.value)}
                          rows={2}
                          className="min-h-[58px] w-full resize-y rounded-[8px] border border-[#E5E2DA] bg-white px-2.5 py-2 text-[11px] leading-relaxed text-[#272622]"
                          placeholder={pfUiT("ui.components.workspace.eb89a8bee8")}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-[12px] border border-[#E5E2DA] bg-[#FCFBF8] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-semibold text-[#272622]">{pfUiT("ui.components.workspace.ff20bb2824")}</h3>
                <p className="mt-1 text-[12px] text-[#6F6C65]">{pfUiT("ui.components.workspace.d4a69400e2")}</p>
              </div>
              <span className="rounded-full border border-[#D9D5CC] bg-white px-2.5 py-1 text-[10px] font-semibold text-[#6F6C65]">{pendingFitProposals.length}</span>
            </div>

            <div className="mt-3 space-y-2">
              {pendingFitProposals.map((proposal) => (
                <div key={proposal.id} className="rounded-[10px] border border-[#E5E2DA] bg-white p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#272622]">{getFitBodyAreaLabel(proposal.measurementCode, metadata)}</span>
                        <span className="rounded-full bg-[#FFF7E7] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8A5A18]">{pfUiT("ui.components.workspace.206d2d40a0")}</span>
                        {proposal.fitSessionId && <span className="font-mono text-[10px] text-[#918D84]">{proposal.fitSessionId}</span>}
                      </div>
                      <div className="mt-2 grid gap-x-6 gap-y-1 text-[11px] text-[#6F6C65] sm:grid-cols-2">
                        <div>{pfUiT("ui.components.workspace.35efe1eb1e")}<strong className="text-[#272622]">{proposal.from?.priority || '—'} → {proposal.to?.priority || '—'}</strong></div>
                        <div>{pfUiT("ui.components.workspace.50a9d54e88")}<strong className="text-[#272622]">{proposal.from?.minimumEase || '—'} → {proposal.to?.minimumEase || '—'} {chart.unit}</strong></div>
                        <div>{pfUiT("ui.components.workspace.465a7463b7")}<strong className="text-[#272622]">{proposal.from?.targetEase || '—'} → {proposal.to?.targetEase || '—'} {chart.unit}</strong></div>
                        <div>{pfUiT("ui.components.workspace.54842de6f9")}<strong className="text-[#272622]">{proposal.from?.maximumPreferredEase || '—'} → {proposal.to?.maximumPreferredEase || '—'} {chart.unit}</strong></div>
                      </div>
                      {proposal.reason && <p className="mt-2 text-[11px] leading-relaxed text-[#6F6C65]">{proposal.reason}</p>}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => decideFitProposal(proposal.id, 'REJECTED')}
                        className="h-9 rounded-[8px] border border-[#D9D5CC] bg-white px-3 text-[11px] font-semibold text-[#6F6C65] hover:bg-[#F4F2ED]"
                      >{pfUiT("ui.components.workspace.cf7bfaad99")}</button>
                      <button
                        type="button"
                        onClick={() => decideFitProposal(proposal.id, 'ACCEPTED')}
                        className="h-9 rounded-[8px] bg-[#272622] px-3 text-[11px] font-semibold text-white hover:bg-[#3A3934]"
                      >{pfUiT("ui.components.workspace.057ababd5e")}</button>
                    </div>
                  </div>
                </div>
              ))}

              {pendingFitProposals.length === 0 && (
                <div className="rounded-[10px] border border-dashed border-[#D9D5CC] bg-white px-4 py-6 text-center text-[12px] text-[#6F6C65]">{pfUiT("ui.components.workspace.0cf59a47cc")}</div>
              )}
            </div>
          </section>
        </div>
      )}

      {activeChartTab === 'history' && (
        <section className="rounded-[12px] border border-[#E5E2DA] bg-[#FCFBF8] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-semibold text-[#272622]">{pfUiT("ui.components.workspace.61571ef15e")}</h3>
              <p className="mt-1 text-[12px] text-[#6F6C65]">{pfUiT("ui.components.workspace.5cfded6a46")}</p>
            </div>
            <span className="rounded-full border border-[#D9D5CC] bg-white px-2.5 py-1 text-[10px] font-semibold text-[#6F6C65]">Current {chart.revisionLabel}</span>
          </div>

          <div className="mt-3 space-y-2">
            <div className="rounded-[10px] border border-[#CFC4B7] bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-2 font-semibold text-[#272622]">
                  <span>{chart.revisionLabel} · Current</span>
                  <span className="rounded-full border border-[#D9D5CC] bg-[#F4F2ED] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#6F6C65]">{chartStatus}</span>
                </span>
                <span className="text-[10px] text-[#918D84]">{chart.revisedAt ? new Date(chart.revisedAt).toLocaleString() : 'Active working revision'}</span>
              </div>
              <div className="mt-1 text-[11px] text-[#6F6C65]">{chart.revisionReason || 'Current Measurement Chart definition.'}</div>
            </div>

            {[...(chart.revisionHistory || [])].reverse().map((revision) => (
              <div key={`${revision.revisionNumber}-${revision.createdAt || ''}`} className="rounded-[10px] border border-[#E5E2DA] bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-2 font-semibold text-[#272622]">
                    <span>{revision.revisionLabel || `V${revision.revisionNumber}`}</span>
                    {revision.status && (
                      <span className="rounded-full border border-[#D9D5CC] bg-[#F4F2ED] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#6F6C65]">{revision.status}</span>
                    )}
                  </span>
                  <span className="text-[10px] text-[#918D84]">{revision.createdAt ? new Date(revision.createdAt).toLocaleString() : ''}</span>
                </div>
                <div className="mt-1 text-[11px] text-[#6F6C65]">
                  {revision.revisionReason || 'Retained technical snapshot'}
                  {revision.fitProfile?.standardCategory ? ` · Fit ${revision.fitProfile.standardCategory}` : ''}
                </div>
              </div>
            ))}

            {!chart.revisionHistory?.length && (
              <div className="rounded-[10px] border border-dashed border-[#D9D5CC] bg-white px-4 py-6 text-center text-[12px] text-[#6F6C65]">{pfUiT("ui.components.workspace.927b85fc7a")}</div>
            )}
          </div>
        </section>
      )}
      </div>
    </div>
  );
}

function ChangeHistoryModule({
  node,
  variant,
  style,
  project,
  workspaceData,
  currentUser,
  t,
  metadata
}) {
  const [activeTab, setActiveTab] =
    useState('activity');

  const storedFormalEntries =
    Array.isArray(node.values?.entries)
      ? node.values.entries
      : [];
  const measurementChartNode = (variant?.children || []).find((child) => child.nodeType === 'sizeSet');
  const measurementChart = measurementChartNode?.values || {};
  const measurementRevisions = [
    ...(measurementChart.revisionHistory || []),
    ...(measurementChart.revisionNumber > 1 && measurementChart.status === 'APPROVED'
      ? [measurementChart]
      : [])
  ].map((revision) => ({
    id: `measurement-chart-${revision.revisionNumber}`,
    module: 'MEASUREMENT_CHART',
    version: revision.revisionLabel || `V${revision.revisionNumber}`,
    toRevision: revision.revisionLabel || `V${revision.revisionNumber}`,
    reason: revision.revisionReason || 'Approved Measurement Chart baseline',
    status: revision.status,
    createdAt: revision.revisedAt || revision.createdAt
  }));
  const formalEntries = Array.from(
    new Map(
      [...storedFormalEntries, ...measurementRevisions]
        .map((entry) => [entry.id || `${entry.module}-${entry.toRevision || entry.version}`, entry])
    ).values()
  );

  const auditEntries =
    (workspaceData?.auditLog || [])
      .filter((entry) => {
        if (!variant?.id) {
          return true;
        }

        const resource =
          entry.resource || {};

        const variantMatch =
          resource.variantId === variant.id ||
          resource.nodeId === variant.id;

        const styleMatch =
          !resource.variantId &&
          style?.id &&
          (
            resource.styleId === style.id ||
            resource.nodeId === style.id
          );

        const projectMatch =
          !resource.variantId &&
          !resource.styleId &&
          project?.id &&
          (
            resource.projectId === project.id ||
            resource.nodeId === project.id
          );

        return (
          variantMatch ||
          styleMatch ||
          projectMatch
        );
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0) -
          new Date(a.createdAt || 0)
      );

  const tabs = [
    {
      id: 'activity',
      label:
        t('audit.tab.activity') ||
        'Activity',
      count:
        auditEntries.length
    },
    {
      id: 'revisions',
      label:
        t('audit.tab.revisions') ||
        'Revisions',
      count:
        formalEntries.length
    }
  ];

  return (
    <div className="space-y-3">
      <section className="rounded-[12px] border border-[#E5E2DA] bg-[#FCFBF8] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-[15px] font-semibold text-[#272622]">{pfUiT("ui.components.workspace.4ceca3bd41")}</h3>
            <p className="mt-0.5 text-[11px] text-[#6F6C65]">{pfUiT("ui.components.workspace.851deb0d7a")}</p>
          </div>

          <div className="flex items-center gap-1 rounded-[9px] border border-[#E5E2DA] bg-[#F4F2ED] p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  setActiveTab(tab.id)
                }
                className={`rounded-[7px] px-2.5 py-1.5 text-[10px] font-semibold ${
                  activeTab === tab.id
                    ? 'bg-white text-[#272622] shadow-sm'
                    : 'text-[#6F6C65]'
                }`}
              >
                {tab.label} · {tab.count}
              </button>
            ))}
          </div>
        </div>
      </section>

      {activeTab === 'activity' && (
        <section className="max-h-[590px] space-y-1.5 overflow-auto rounded-[12px] border border-[#E5E2DA] bg-[#FCFBF8] p-3">
          {auditEntries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-[9px] border border-[#E5E2DA] bg-white px-3 py-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-[#272622]">
                      {entry.actor?.name ||
                        entry.actor?.login ||
                        'Workspace user'}
                    </span>

                    {entry.actor?.login && (
                      <span className="text-[9px] text-[#918D84]">
                        {entry.actor.login}
                      </span>
                    )}

                    <span className="rounded-full bg-[#F4F2ED] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-[#6F6C65]">
                      {entry.source === 'COLLABORATION'
                        ? 'Collaboration'
                        : 'Saved change'}
                    </span>
                  </div>

                  <div className="mt-1 text-[10px] text-[#6F6C65]">
                    <span className="font-medium text-[#4A4741]">
                      {entry.resource?.module ||
                        entry.resource?.nodeType}
                    </span>
                    {' · '}
                    {entry.field}
                  </div>
                </div>

                <span className="shrink-0 text-[9px] text-[#918D84]">
                  {entry.createdAt
                    ? new Date(entry.createdAt).toLocaleString()
                    : '—'}
                </span>
              </div>

              <div className="mt-1.5 grid gap-1 text-[10px] sm:grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)]">
                <div className="truncate rounded-[7px] bg-[#F8F7F3] px-2 py-1 text-[#918D84]">
                  {entry.previousValue === null ||
                  entry.previousValue === undefined
                    ? '—'
                    : typeof entry.previousValue === 'object'
                    ? JSON.stringify(entry.previousValue)
                    : String(entry.previousValue)}
                </div>
                <div className="text-center text-[#BCA892]">
                  →
                </div>
                <div className="truncate rounded-[7px] bg-[#F8F7F3] px-2 py-1 font-medium text-[#272622]">
                  {entry.newValue === null ||
                  entry.newValue === undefined
                    ? '—'
                    : typeof entry.newValue === 'object'
                    ? JSON.stringify(entry.newValue)
                    : String(entry.newValue)}
                </div>
              </div>
            </article>
          ))}

          {!auditEntries.length && (
            <div className="rounded-[10px] border border-dashed border-[#D9D5CC] bg-white px-4 py-7 text-center text-[12px] text-[#6F6C65]">{pfUiT("ui.components.workspace.b6d35a5868")}</div>
          )}
        </section>
      )}

      {activeTab === 'revisions' && (
        <section className="max-h-[590px] space-y-2 overflow-auto rounded-[12px] border border-[#E5E2DA] bg-[#FCFBF8] p-3">
          {formalEntries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-[10px] border border-[#E5E2DA] bg-white px-3 py-2.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-[#272622]">
                      {entry.module === 'MEASUREMENT_CHART'
                        ? `Measurement Chart ${entry.toRevision || entry.version || ''}`
                        : entry.reason ||
                          entry.version ||
                          'Revision'}
                    </span>

                    {entry.fromRevision &&
                      entry.toRevision && (
                        <span className="rounded-full bg-[#F4F2ED] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#6F6C65]">
                          {entry.fromRevision} → {entry.toRevision}
                        </span>
                      )}
                  </div>

                  {entry.reason && (
                    <p className="mt-1 text-[11px] leading-relaxed text-[#6F6C65]">
                      {entry.reason}
                    </p>
                  )}
                </div>

                <span className="shrink-0 text-[10px] text-[#918D84]">
                  {entry.createdAt
                    ? new Date(entry.createdAt).toLocaleString()
                    : '—'}
                </span>
              </div>

              {Array.isArray(entry.changes) &&
                entry.changes.length > 0 && (
                  <div className="mt-2 overflow-hidden rounded-[8px] border border-[#EEEAE2]">
                    {entry.changes
                      .slice(0, 8)
                      .map(
                        (
                          change,
                          index
                        ) => (
                          <div
                            key={`${entry.id}-${index}`}
                            className="grid gap-1 border-b border-[#EEEAE2] px-2.5 py-1.5 text-[10px] last:border-b-0 sm:grid-cols-[minmax(160px,1fr)_100px_20px_100px]"
                          >
                            <span className="truncate font-medium text-[#4A4741]">
                              {change.measurement
                                ? `${change.measurement}${change.sizeReference ? ` · ${change.sizeReference}` : ''}`
                                : change.field}
                            </span>
                            <span className="truncate text-[#918D84]">
                              {String(
                                change.previousValue ??
                                  '—'
                              )}
                            </span>
                            <span className="text-center text-[#BCA892]">
                              →
                            </span>
                            <span className="truncate font-semibold text-[#272622]">
                              {String(
                                change.newValue ??
                                  '—'
                              )}
                            </span>
                          </div>
                        )
                      )}
                  </div>
                )}
            </article>
          ))}

          {!formalEntries.length && (
            <div className="rounded-[10px] border border-dashed border-[#D9D5CC] bg-white px-4 py-7 text-center text-[12px] text-[#6F6C65]">{pfUiT("ui.components.workspace.02deaeb7c0")}</div>
          )}
        </section>
      )}
    </div>
  );
}


function ArchivedSizeSetFilePrototype({
  metadata,
  node,
  variant,
  onChange,
  t
}) {
  const patternLibraryNode = variant?.children?.find((child) => child.nodeType === 'patternLibrary');
  const library = normalizePatternLibraryValues(patternLibraryNode?.values || {}, variant);
  const sizes = Array.isArray(node.values?.sizes) && node.values.sizes.length
    ? node.values.sizes
    : ['XS', 'S', 'M', 'L', 'XL'];
  const baseReferenceSize = node.values?.baseReferenceSize || variant?.values?.['variant.base_reference_size'] || 'M';
  const [sizeInput, setSizeInput] = useState(sizes.join(', '));
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadForm, setUploadForm] = useState(() => ({
    file: null,
    sourceProvider: 'MANUAL_UNSPECIFIED',
    technicalType: 'DXF_AAMA',
    coveredSizes: sizes,
    status: 'DRAFT',
    notes: ''
  }));

  useEffect(() => {
    setSizeInput(sizes.join(', '));
  }, [node.id, sizes.join('|')]);

  const typeOptions = metadata.dropdowns?.PATTERN_TECHNICAL_TYPE || [];
  const providerOptions = metadata.dropdowns?.PATTERN_SOURCE_PROVIDER || [];
  const baseSizeOptions = metadata.dropdowns?.BASE_REFERENCE_SIZE || [];
  const variantCode = variant?.values?.['variant.code'] || 'PF-V01';
  const sizeSetFiles = getSizeSetFiles(library);
  const selectedFile = sizeSetFiles.find((file) => file.id === selectedFileId) || sizeSetFiles[0] || null;
  const coveredSizes = Array.from(new Set(sizeSetFiles.flatMap((file) => file.coveredSizes || [])));
  const missingSizes = sizes.filter((size) => !coveredSizes.includes(size));
  const coverageComplete = sizes.length > 0 && missingSizes.length === 0 && sizeSetFiles.length > 0;

  const persistLibrary = (nextLibrary) => {
    if (!patternLibraryNode) return;
    onChange('__replaceValues', null, patternLibraryNode.id, nextLibrary);
  };

  const createReference = () => {
    return generatePatternFileReference({
      variantReference: variantCode,
      existingReferences: (library.files || []).map((file) => file.reference)
    });
  };

  const commitSizes = () => {
    const nextSizes = sizeInput
      .split(',')
      .map((size) => size.trim())
      .filter(Boolean);

    if (!nextSizes.length) {
      setSizeInput(sizes.join(', '));
      return;
    }

    onChange('sizes', nextSizes, node.id);
    setUploadForm((current) => ({
      ...current,
      coveredSizes: current.coveredSizes.filter((size) => nextSizes.includes(size)).length
        ? current.coveredSizes.filter((size) => nextSizes.includes(size))
        : nextSizes
    }));
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    setUploadError('');

    if (!patternLibraryNode) {
      setUploadError('Pattern Library storage is missing for this variant.');
      return;
    }

    if (!uploadForm.file) {
      setUploadError('Select a graded pattern file before confirming upload.');
      return;
    }

    const typeOption = typeOptions.find((option) => option.code === uploadForm.technicalType) || {};
    const now = getNowIso();
    const id = `pattern-file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    try {
      await putPatternBinary(id, uploadForm.file);
    } catch (error) {
      setUploadError(error.message || 'Could not store this file locally.');
      return;
    }

    const nextFile = {
      id,
      reference: createReference(),
      originalFilename: uploadForm.file.name,
      fileSize: uploadForm.file.size,
      mimeType: uploadForm.file.type || '',
      destination: 'SIZE_SET',
      technicalRole: 'SIZE_SET',
      authoritative: false,
      sourceProvider: uploadForm.sourceProvider,
      intakeMethod: 'MANUAL_UPLOAD',
      technicalType: uploadForm.technicalType,
      format: typeOption.format || '',
      outputProfile: typeOption.outputProfile || '',
      sizeSetName: node.title || 'Default Size Set',
      coveredSizes: uploadForm.coveredSizes,
      status: uploadForm.status,
      notes: uploadForm.notes,
      createdAt: now,
      updatedAt: now
    };

    persistLibrary({
      ...library,
      files: [...(library.files || []), nextFile]
    });
    setSelectedFileId(id);
    setUploadOpen(false);
    setUploadForm((current) => ({
      ...current,
      file: null,
      notes: ''
    }));
  };

  const handleDownload = async (file) => {
    if (!file) return;

    const stored = await getPatternBinary(file.id);
    if (!stored?.blob) return;

    const url = URL.createObjectURL(stored.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = stored.name || file.originalFilename || `${file.reference}.bin`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteFile = async (fileId) => {
    const nextFiles = (library.files || []).filter((file) => file.id !== fileId);

    try {
      await deletePatternBinary(fileId);
    } catch {}

    persistLibrary({
      ...library,
      files: nextFiles
    });
    setSelectedFileId(nextFiles.find((file) => file.destination === 'SIZE_SET')?.id || null);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[12px] border border-[#E5E2DA] bg-[#FCFBF8] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-[16px] font-semibold text-[#272622]">{pfUiT("ui.components.workspace.62ad5f9229")}</h3>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[#6F6C65]">{pfUiT("ui.components.workspace.badded275e")}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
            coverageComplete
              ? 'bg-[#E8F5EC] text-[#2F7B4A]'
              : 'bg-[#FFF7E8] text-[#9A6A1D]'
          }`}>
            {coverageComplete ? 'Coverage complete' : 'Coverage incomplete'}
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6F6C65]">{pfUiT("ui.components.workspace.c6b10b1f09")}</span>
            <input
              value={sizeInput}
              onChange={(event) => setSizeInput(event.target.value)}
              onBlur={commitSizes}
              className="w-full rounded-[9px] border border-[#E5E2DA] bg-white px-3 py-2 text-[13px]"
              placeholder={pfUiT("ui.components.workspace.ca7d561745")}
            />
            <span className="block text-[11px] text-[#918D84]">{pfUiT("ui.components.workspace.00369d6211")}</span>
          </label>

          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6F6C65]">{pfUiT("ui.components.workspace.a0046146d6")}</span>
            <select
              value={baseReferenceSize}
              onChange={(event) => onChange('baseReferenceSize', event.target.value, node.id)}
              className="w-full rounded-[9px] border border-[#E5E2DA] bg-white px-3 py-2 text-[13px]"
            >
              {baseSizeOptions.map((option) => (
                <option key={option.code} value={option.code}>{t(option.labelKey)}</option>
              ))}
            </select>
            <span className="block text-[11px] text-[#918D84]">{pfUiT("ui.components.workspace.8ba66c00fb")}</span>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {sizes.map((size) => (
            <span
              key={size}
              className={`rounded-full border px-3 py-1.5 text-[12px] ${
                coveredSizes.includes(size)
                  ? 'border-[#BFDCC8] bg-[#E8F5EC] text-[#2F7B4A]'
                  : 'border-[#E5D2A8] bg-[#FFF7E8] text-[#9A6A1D]'
              }`}
            >
              {size} {coveredSizes.includes(size) ? 'ready' : 'missing file'}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-[12px] border border-[#E5E2DA] bg-[#FCFBF8]">
        <div className="flex flex-col gap-3 border-b border-[#E5E2DA] px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-[#272622]">{pfUiT("ui.components.workspace.0fba024bbf")}</h3>
            <p className="mt-1 text-[12px] text-[#6F6C65]">{pfUiT("ui.components.workspace.fd662e5cf3")}</p>
          </div>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[9px] bg-[#272622] px-3.5 text-[12px] font-semibold text-white hover:bg-[#3A3934]"
          >
            <Upload className="h-4 w-4" />{pfUiT("ui.components.workspace.6ceb0ec342")}</button>
        </div>

        <div className="grid min-h-[320px] lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-auto">
            <table className="min-w-full text-left text-[12px]">
              <thead className="border-b border-[#E5E2DA] text-[11px] uppercase tracking-[0.12em] text-[#918D84]">
                <tr>
                  <th className="px-4 py-3 font-semibold">{pfUiT("ui.components.workspace.23b236e131")}</th>
                  <th className="px-4 py-3 font-semibold">{pfUiT("ui.components.workspace.7fce3f6685")}</th>
                  <th className="px-4 py-3 font-semibold">{pfUiT("ui.components.workspace.ef540fde9a")}</th>
                  <th className="px-4 py-3 font-semibold">{pfUiT("ui.components.workspace.2ba050b648")}</th>
                  <th className="px-4 py-3 font-semibold">{pfUiT("ui.components.workspace.4a65be85a1")}</th>
                </tr>
              </thead>
              <tbody>
                {sizeSetFiles.map((file) => (
                  <tr
                    key={file.id}
                    onClick={() => setSelectedFileId(file.id)}
                    className={`cursor-pointer border-b border-[#EEEAE2] ${
                      selectedFile?.id === file.id ? 'bg-[#EFEEE8]' : 'hover:bg-[#F8F7F3]'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#272622]">{file.reference}</div>
                      <div className="mt-0.5 max-w-[240px] truncate text-[#918D84]">{file.originalFilename}</div>
                    </td>
                    <td className="px-4 py-3 text-[#6F6C65]">{file.format || file.technicalType}{file.outputProfile ? ` - ${file.outputProfile}` : ''}</td>
                    <td className="px-4 py-3 text-[#6F6C65]">{file.coveredSizes?.length ? file.coveredSizes.join(', ') : '-'}</td>
                    <td className="px-4 py-3 text-[#6F6C65]">{getDropdownLabel(metadata, 'PATTERN_FILE_STATUS', file.status, t) || file.status || 'Draft'}</td>
                    <td className="px-4 py-3 text-[#6F6C65]">{file.updatedAt?.slice(0, 10) || '-'}</td>
                  </tr>
                ))}
                {sizeSetFiles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[13px] text-[#6F6C65]">{pfUiT("ui.components.workspace.c9248d2270")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <aside className="border-t border-[#E5E2DA] bg-[#F8F7F3] p-4 lg:border-l lg:border-t-0">
            {selectedFile ? (
              <div className="space-y-3 text-[12px]">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#918D84]">{pfUiT("ui.components.workspace.8a1af8e4d4")}</div>
                  <div className="mt-1 text-[15px] font-semibold text-[#272622]">{selectedFile.reference}</div>
                </div>
                {[
                  ['Original filename', selectedFile.originalFilename],
                  ['Format', selectedFile.format],
                  ['Output profile', selectedFile.outputProfile],
                  ['Source provider', getDropdownLabel(metadata, 'PATTERN_SOURCE_PROVIDER', selectedFile.sourceProvider, t)],
                  ['Covered sizes', selectedFile.coveredSizes?.join(', ')],
                  ['Status', getDropdownLabel(metadata, 'PATTERN_FILE_STATUS', selectedFile.status, t)]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[9px] border border-[#E5E2DA] bg-[#FCFBF8] px-3 py-2">
                    <div className="text-[#918D84]">{label}</div>
                    <div className="mt-0.5 font-medium text-[#272622]">{value || '-'}</div>
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleDownload(selectedFile)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-[9px] border border-[#D9D5CC] bg-[#FCFBF8] px-3 py-2 font-semibold text-[#272622] hover:bg-[#EFEEE8]"
                  >
                    <Download className="h-3.5 w-3.5" />{pfUiT("ui.components.workspace.a364c47a55")}</button>
                  <button
                    type="button"
                    onClick={() => handleDeleteFile(selectedFile.id)}
                    className="inline-flex items-center justify-center rounded-[9px] border border-[#E8C9C1] bg-[#FFF7F5] px-3 py-2 text-[#9A3D2F] hover:bg-[#F6EDEA]"
                    aria-label={pfUiT("ui.components.workspace.879bdfb18c")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[220px] items-center justify-center rounded-[10px] border border-dashed border-[#D9D5CC] text-center text-[13px] text-[#6F6C65]">
                <div>
                  <Database className="mx-auto h-7 w-7 text-[#918D84]" />
                  <p className="mt-2">{pfUiT("ui.components.workspace.f38cb05b80")}</p>
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

      {uploadOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-[#272622]/35 p-4"
          style={{ zIndex: UI_LAYERS.modalBackdrop }}
        >
          <form
            onSubmit={handleUpload}
            className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-[14px] border border-[#D9D5CC] bg-[#FCFBF8] shadow-[0_30px_80px_rgba(39,38,34,0.22)]"
          >
            <div className="flex items-center justify-between border-b border-[#E5E2DA] px-5 py-4">
              <h3 className="text-[16px] font-semibold text-[#272622]">{pfUiT("ui.components.workspace.6ceb0ec342")}</h3>
              <button type="button" onClick={() => setUploadOpen(false)} className="rounded-lg p-1.5 text-[#6F6C65] hover:bg-[#EFEEE8]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <label
                className="sm:col-span-2 rounded-[12px] border border-dashed border-[#D9D5CC] bg-[#F8F7F3] p-5 text-center text-[13px] text-[#6F6C65]"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  setUploadForm((current) => ({
                    ...current,
                    file: event.dataTransfer.files?.[0] || current.file
                  }));
                }}
              >
                <Upload className="mx-auto h-7 w-7 text-[#918D84]" />
                <span className="mt-2 block font-medium text-[#272622]">{uploadForm.file?.name || 'Choose a graded pattern file'}</span>
                <input
                  type="file"
                  className="sr-only"
                  onChange={(event) => setUploadForm((current) => ({ ...current, file: event.target.files?.[0] || null }))}
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold text-[#6F6C65]">{pfUiT("ui.components.workspace.62cce1c1a3")}</span>
                <select value={uploadForm.sourceProvider} onChange={(event) => setUploadForm((current) => ({ ...current, sourceProvider: event.target.value }))} className="w-full rounded-[9px] border border-[#E5E2DA] bg-white px-3 py-2 text-[13px]">
                  {providerOptions.map((option) => (
                    <option key={option.code} value={option.code}>{t(option.labelKey)}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold text-[#6F6C65]">{pfUiT("ui.components.workspace.0050be9e51")}</span>
                <select value={uploadForm.technicalType} onChange={(event) => setUploadForm((current) => ({ ...current, technicalType: event.target.value }))} className="w-full rounded-[9px] border border-[#E5E2DA] bg-white px-3 py-2 text-[13px]">
                  {typeOptions.map((option) => (
                    <option key={option.code} value={option.code}>{t(option.labelKey)}</option>
                  ))}
                </select>
              </label>


              <div className="sm:col-span-2">
                <span className="text-[11px] font-semibold text-[#6F6C65]">{pfUiT("ui.components.workspace.ef540fde9a")}</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {sizes.map((size) => (
                    <label key={size} className="inline-flex items-center gap-1.5 rounded-full border border-[#D9D5CC] bg-[#F4F2ED] px-3 py-1.5 text-[12px]">
                      <input
                        type="checkbox"
                        checked={uploadForm.coveredSizes.includes(size)}
                        onChange={(event) => setUploadForm((current) => ({
                          ...current,
                          coveredSizes: event.target.checked
                            ? [...current.coveredSizes, size]
                            : current.coveredSizes.filter((item) => item !== size)
                        }))}
                      />
                      {size}
                    </label>
                  ))}
                </div>
              </div>

              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-[11px] font-semibold text-[#6F6C65]">{pfUiT("ui.components.workspace.df6141c39a")}</span>
                <textarea value={uploadForm.notes} onChange={(event) => setUploadForm((current) => ({ ...current, notes: event.target.value }))} rows={3} className="w-full rounded-[9px] border border-[#E5E2DA] bg-white px-3 py-2 text-[13px]" />
              </label>

              {uploadError && (
                <div className="sm:col-span-2 rounded-[10px] border border-[#E8C9C1] bg-[#FFF7F5] px-3 py-2 text-[12px] text-[#9A3D2F]">
                  {uploadError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#E5E2DA] px-5 py-4">
              <button type="button" onClick={() => setUploadOpen(false)} className="rounded-[9px] border border-[#D9D5CC] px-3.5 py-2 text-[12px] font-semibold text-[#4A4741] hover:bg-[#EFEEE8]">{pfUiT("ui.components.workspace.3e708f4001")}</button>
              <button type="submit" className="rounded-[9px] bg-[#272622] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#3A3934]">{pfUiT("ui.components.workspace.9ddda22302")}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function buildWorkspaceLegacyPattern({
  metadata,
  variant,
  style,
  project,
  t
}) {
  const workspaceId = variant?.id || variant?.values?.['variant.code'] || style?.id || '';
  const sizeNode = variant?.children?.find((child) => child.nodeType === 'sizeSet');
  const styleValues = style?.values || {};
  const variantValues = variant?.values || {};
  const measurementChart = normalizeMeasurementChartValues(sizeNode?.values || {}, variantValues, metadata, styleValues);
  const category =
    getDropdownLabel(metadata, 'GARMENT_CATEGORY', styleValues['product.category'], t) ||
    'Pattern';
  const difficulty =
    getDropdownLabel(metadata, 'DIFFICULTY_LEVEL', styleValues['product.difficulty'], t) ||
    'Intermediate';
  const name =
    styleValues['product.style_name'] ||
    variantValues['variant.name'] ||
    project?.values?.['project.name'] ||
    'Workspace Pattern';
  const description =
    styleValues['product.description'] ||
    'Workspace-linked sewing and technical development pattern.';
  const sizes = getDisplaySizeReferences(measurementChart, measurementChart.displaySystem).length
    ? getDisplaySizeReferences(measurementChart, measurementChart.displaySystem)
    : [];

  return {
    id: workspaceId,
    workspaceVariantId: variant?.id,
    name,
    category,
    difficulty,
    description,
    sizes,
    sizeSystems: getCustomerSizeSystems(measurementChart, metadata),
    defaultSizeSystemKey: measurementChart.displaySystem,
    baseReferenceSize: resolveBaseSizeReference(
      measurementChart,
      measurementChart.displaySystem,
      variantValues['variant.base_reference_size']
    ),
    price: Number(styleValues['product.price'] || 0),
    fabricSuggestions: [],
    yardageInfo: {}
  };
}


function ProjectJournalWorkspaceModule({
  metadata,
  node,
  variant,
  style,
  project,
  currentUser,
  onChange,
  t
}) {
  const workspacePattern = useMemo(
    () => buildWorkspaceLegacyPattern({ metadata, variant, style, project, t }),
    [metadata, project, style, t, variant]
  );
  const measurementNode = useMemo(
    () => (variant?.children || []).find((child) => child.nodeType === 'sizeSet') || null,
    [variant]
  );

  return (
    <ProjectJournalModuleView
      node={node}
      variant={variant}
      style={style}
      project={project}
      onChange={onChange}
      measurementNode={measurementNode}
      workspacePattern={workspacePattern}
      currentUser={currentUser}
      metadata={metadata}
    />
  );
}


function ConstructionFieldControl({
  field,
  value,
  onChange,
  t
}) {
  const commonClass =
    'h-8 w-full rounded-[7px] border border-[#E5E2DA] bg-white px-2 text-[10px] text-[#272622] focus:border-[#BCA892] focus:outline-none focus:ring-1 focus:ring-[#BCA892]/25';

  if (field.type === 'number') {
    return (
      <input
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        value={value ?? ''}
        aria-label={t(field.labelKey)}
        onChange={(event) =>
          onChange(
            event.target.value === ''
              ? ''
              : Number(event.target.value)
          )
        }
        className={`${commonClass} ${
          field.align === 'center'
            ? 'text-center'
            : ''
        }`}
      />
    );
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        value={value ?? ''}
        rows={field.rows || 3}
        aria-label={t(field.labelKey)}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full resize-y rounded-[8px] border border-[#E5E2DA] bg-white px-2.5 py-2 text-[10px] leading-relaxed text-[#272622] focus:border-[#BCA892] focus:outline-none focus:ring-1 focus:ring-[#BCA892]/25"
      />
    );
  }

  return (
    <input
      type="text"
      value={value ?? ''}
      aria-label={t(field.labelKey)}
      onChange={(event) =>
        onChange(event.target.value)
      }
      className={commonClass}
    />
  );
}

function SewingModule({
  metadata,
  node,
  variant,
  style,
  project,
  onChange,
  t
}) {
  const [activeTab, setActiveTab] = useState(
    metadata.sewing?.tabs?.[0]?.code || 'CONSTRUCTION'
  );
  const [selectedConstructionStepId, setSelectedConstructionStepId] = useState('');
  const [selectedOperationId, setSelectedOperationId] = useState('');

  const values = node?.values || {};
  const constructionConfig = metadata.sewing?.construction || {};
  const constructionGridFields = Array.isArray(constructionConfig.gridFields)
    ? constructionConfig.gridFields
    : [];
  const constructionDetailFields = Array.isArray(constructionConfig.detailFields)
    ? constructionConfig.detailFields
    : [];
  const constructionRequirementFields = Array.isArray(constructionConfig.requirementFields)
    ? constructionConfig.requirementFields
    : [];
  const constructionOperationFields = Array.isArray(constructionConfig.operationFields)
    ? constructionConfig.operationFields
    : [];

  const workspacePattern = useMemo(
    () => buildWorkspaceLegacyPattern({ metadata, variant, style, project, t }),
    [metadata, project, style, t, variant]
  );

  const constructionSteps = Array.isArray(values.constructionSteps)
    ? values.constructionSteps
    : [];
  const operations = Array.isArray(values.operations)
    ? values.operations
    : [];
  const qualityChecks = Array.isArray(values.qualityChecks)
    ? values.qualityChecks
    : [];
  const studyData = values.timeMotion || {};

  const selectedConstructionStep =
    constructionSteps.find((step) => step.id === selectedConstructionStepId) || null;
  const selectedOperation =
    operations.find((operation) => operation.id === selectedOperationId) || null;

  useEffect(() => {
    if (
      selectedConstructionStepId &&
      !constructionSteps.some((step) => step.id === selectedConstructionStepId)
    ) {
      setSelectedConstructionStepId('');
      setSelectedOperationId('');
    }
  }, [constructionSteps, selectedConstructionStepId]);

  useEffect(() => {
    if (
      selectedOperationId &&
      !operations.some((operation) => operation.id === selectedOperationId)
    ) {
      setSelectedOperationId('');
    }
  }, [operations, selectedOperationId]);

  const persistSewing = (patch) => {
    onChange?.('__replaceValues', null, node.id, {
      ...values,
      ...patch
    });
  };

  const patchConstructionStep = (stepId, patch) => {
    persistSewing({
      constructionSteps: constructionSteps.map((step) =>
        step.id === stepId ? { ...step, ...patch } : step
      )
    });
  };

  const getConstructionRequirements = (step) =>
    Array.isArray(step?.requirements) ? step.requirements : [];

  const addConstructionRequirement = (stepId) => {
    const step = constructionSteps.find((item) => item.id === stepId);
    if (!step) return;

    patchConstructionStep(stepId, {
      requirements: [
        ...getConstructionRequirements(step),
        {
          id: `requirement-${Date.now()}`,
          item: '',
          quantity: '',
          notes: ''
        }
      ]
    });
  };

  const patchConstructionRequirement = (stepId, requirementId, patch) => {
    const step = constructionSteps.find((item) => item.id === stepId);
    if (!step) return;

    patchConstructionStep(stepId, {
      requirements: getConstructionRequirements(step).map((requirement) =>
        requirement.id === requirementId
          ? { ...requirement, ...patch }
          : requirement
      )
    });
  };

  const removeConstructionRequirement = (stepId, requirementId) => {
    const step = constructionSteps.find((item) => item.id === stepId);
    if (!step) return;

    patchConstructionStep(stepId, {
      requirements: getConstructionRequirements(step).filter(
        (requirement) => requirement.id !== requirementId
      )
    });
  };

  const addConstructionStep = () => {
    const nextOrder = constructionSteps.reduce(
      (maximum, step) => Math.max(maximum, Number(step.order || 0)),
      0
    ) + 1;
    const stepId = `sewing-step-${Date.now()}`;

    persistSewing({
      constructionSteps: [
        ...constructionSteps,
        {
          id: stepId,
          order: nextOrder,
          title: '',
          seamType: '',
          seamAllowance: '',
          machine: '',
          qualityCheckpoint: '',
          notes: '',
          requirements: []
        }
      ]
    });

    setSelectedOperationId('');
    setSelectedConstructionStepId(stepId);
  };

  const removeConstructionStep = (stepId) => {
    persistSewing({
      constructionSteps: constructionSteps
        .filter((step) => step.id !== stepId)
        .map((step, index) => ({ ...step, order: index + 1 })),
      operations: operations.filter(
        (operation) => operation.constructionStepId !== stepId
      )
    });

    if (selectedConstructionStepId === stepId) {
      setSelectedConstructionStepId('');
      setSelectedOperationId('');
    }
  };

  const addOperationForConstructionStep = (constructionStep) => {
    if (!constructionStep?.id) return;

    const linkedOperations = operations.filter(
      (operation) => operation.constructionStepId === constructionStep.id
    );
    const operationNumber = linkedOperations.length + 1;
    const parentStep = String(constructionStep.order || 1).padStart(2, '0');
    const operationId = `operation-${constructionStep.id}-${Date.now()}`;

    persistSewing({
      operations: [
        ...operations,
        {
          id: operationId,
          constructionStepId: constructionStep.id,
          step: `${parentStep}.${operationNumber}`,
          op: '',
          machine: constructionStep.machine || '',
          method: constructionStep.seamType || '',
          notes: '',
          observations: [],
          ratingFactor: metadata.sewing?.timeMotion?.defaults?.ratingDefault ?? 100,
          allowanceFactor: metadata.sewing?.timeMotion?.defaults?.allowanceDefault ?? 12,
          standardStatus: 'DRAFT'
        }
      ]
    });

    setSelectedConstructionStepId(constructionStep.id);
    setSelectedOperationId(operationId);
  };

  const patchOperation = (operationId, patch) => {
    persistSewing({
      operations: operations.map((operation) =>
        operation.id === operationId ? { ...operation, ...patch } : operation
      )
    });
  };

  const removeOperation = (operationId) => {
    persistSewing({
      operations: operations.filter((operation) => operation.id !== operationId)
    });

    if (selectedOperationId === operationId) {
      setSelectedOperationId('');
    }
  };

  const addQualityCheck = () => {
    persistSewing({
      qualityChecks: [
        ...qualityChecks,
        {
          id: `quality-${Date.now()}`,
          checkpoint: '',
          tolerance: '',
          notes: ''
        }
      ]
    });
  };

  const patchQualityCheck = (checkId, patch) => {
    persistSewing({
      qualityChecks: qualityChecks.map((check) =>
        check.id === checkId ? { ...check, ...patch } : check
      )
    });
  };

  const sewingFacts = [
    [t('sewing.context.variant'), variant?.values?.['variant.code'] || workspacePattern.workspaceVariantId || '-'],
    [t('sewing.context.pattern'), workspacePattern.name || '-']
  ];
  const tabs = metadata.sewing?.tabs || [];

  const subtleInputClass =
    'h-8 w-full rounded-[7px] border border-[#E7E2D9] bg-[#FCFBF8] px-2 text-[10px] text-[#272622] outline-none transition focus:border-[#BCA892] focus:bg-white focus:ring-1 focus:ring-[#BCA892]/20';

  const operationEditableFields = constructionOperationFields.filter(
    (field) => !['step', 'standardStatus'].includes(field.key)
  );

  return (
    <div className="space-y-3">
      <section className="flex flex-wrap items-center justify-between gap-2 rounded-[11px] border border-[#E5E2DA] bg-[#FCFBF8] px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {sewingFacts.map(([label, value]) => (
            <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-[#E5D8C7] bg-white px-2.5 py-1 text-[9px] font-semibold text-[#6F5A42]">
              <span className="uppercase tracking-[0.08em] text-[#A08158]">{label}</span>
              <span className="max-w-[220px] truncate text-[#272622]">{value}</span>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-[8px] border border-[#E5E2DA] bg-[#F4F2ED] p-1">
          {tabs.map((tab) => (
            <button
              key={tab.code}
              type="button"
              onClick={() => setActiveTab(tab.code)}
              className={`rounded-[6px] px-2.5 py-1.5 text-[9px] font-semibold transition ${
                activeTab === tab.code
                  ? 'bg-white text-[#272622] shadow-sm'
                  : 'text-[#6F6C65] hover:text-[#272622]'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'CONSTRUCTION' && (
        <div className="grid h-[calc(100vh-220px)] min-h-[500px] gap-3 overflow-hidden xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
          <section className="flex min-h-0 flex-col rounded-[12px] border border-[#E5E2DA] bg-white p-3">
            <div className="flex shrink-0 items-center justify-between gap-2">
              <div>
                <h3 className="text-[13px] font-semibold text-[#272622]">
                  {t('sewing.construction.title')}
                </h3>
                <p className="mt-0.5 text-[10px] text-[#6F6C65]">
                  {t('sewing.construction.subtitle')}
                </p>
              </div>

              <button
                type="button"
                onClick={addConstructionStep}
                className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-[#272622] px-3 text-[9px] font-semibold text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('sewing.action.addStep')}
              </button>
            </div>

            <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {constructionSteps.map((step, index) => {
                const selected = selectedConstructionStepId === step.id;
                const linkedOperations = operations.filter(
                  (operation) => operation.constructionStepId === step.id
                );
                const requirementsCount = getConstructionRequirements(step).length;

                return (
                  <article
                    key={step.id}
                    className={`overflow-hidden rounded-[12px] border bg-white transition ${
                      selected
                        ? 'border-[#CBB9A3] shadow-[0_8px_22px_rgba(60,48,36,0.06)]'
                        : 'border-[#E5E2DA] hover:border-[#D4CDC2]'
                    }`}
                  >
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (selected) {
                            setSelectedConstructionStepId('');
                            setSelectedOperationId('');
                          } else {
                            setSelectedConstructionStepId(step.id);
                            setSelectedOperationId('');
                          }
                        }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-[#E7E2D9] bg-[#FCFBF8] text-[#6F6C65]"
                        aria-label={selected ? 'Collapse construction step' : 'Expand construction step'}
                      >
                        {selected ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedConstructionStepId(step.id);
                          setSelectedOperationId('');
                        }}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span className="flex h-8 min-w-10 shrink-0 items-center justify-center rounded-[8px] bg-[#F1EEE8] px-2 font-mono text-[11px] font-semibold text-[#6F5A42]">
                          {String(step.order || index + 1).padStart(2, '0')}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-semibold text-[#272622]">
                            {step.title || t('sewing.field.instruction')}
                          </span>
                          <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-[#918D84]">
                            {step.seamType && <span>{step.seamType}</span>}
                            {step.machine && <span>{step.machine}</span>}
                            {step.seamAllowance && <span>{step.seamAllowance}</span>}
                            <span>{linkedOperations.length} op.</span>
                            {requirementsCount > 0 && <span>{requirementsCount} req.</span>}
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => addOperationForConstructionStep(step)}
                        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[8px] border border-[#D9D5CC] bg-white px-2.5 text-[8px] font-semibold text-[#4A4741] hover:bg-[#F4F2ED]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t('sewing.operations.add')}
                      </button>

                      <button
                        type="button"
                        onClick={() => removeConstructionStep(step.id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#9A3D2F] hover:bg-[#FFF4F1]"
                        aria-label={t('sewing.action.remove')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {selected && (
                      <div className="border-t border-[#EEEAE2] bg-[#FAF9F6] px-3 py-2.5">
                        <div className="mb-2">
                          <h4 className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#6F5A42]">
                            {t('sewing.operations.title')}
                          </h4>
                          <p className="mt-0.5 text-[8px] text-[#918D84]">
                            {linkedOperations.length} active {linkedOperations.length === 1 ? 'operation' : 'operations'}
                          </p>
                        </div>

                        {linkedOperations.length ? (
                          <div className="space-y-1.5">
                            {linkedOperations.map((operation) => {
                              const releasedStatus =
                                operation.standardStatus && operation.standardStatus !== 'DRAFT'
                                  ? operation.standardStatus
                                  : '';
                              const operationSelected = selectedOperationId === operation.id;
                              const secondary = [operation.machine, operation.method, operation.notes]
                                .filter(Boolean)
                                .join(' · ');

                              return (
                                <div
                                  key={operation.id}
                                  className={`flex items-center gap-2 rounded-[9px] border bg-white px-2.5 py-2 transition ${
                                    operationSelected
                                      ? 'border-[#CBB9A3] bg-[#FFFDFC]'
                                      : 'border-[#E5E2DA] hover:border-[#D4CDC2]'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedConstructionStepId(step.id);
                                      setSelectedOperationId(operation.id);
                                    }}
                                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                  >
                                    <span className="flex h-7 min-w-12 shrink-0 items-center justify-center rounded-[7px] bg-[#F4F2ED] px-2 font-mono text-[9px] font-semibold text-[#6F5A42]">
                                      {operation.step || '--'}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-[10px] font-semibold text-[#272622]">
                                        {operation.op || t('sewing.field.operation')}
                                      </span>
                                      {secondary && (
                                        <span className="mt-0.5 block truncate text-[8px] text-[#918D84]">
                                          {secondary}
                                        </span>
                                      )}
                                    </span>
                                    {releasedStatus && (
                                      <span className="rounded-full bg-[#F1EEE8] px-2 py-1 text-[8px] font-semibold text-[#6F6C65]">
                                        {releasedStatus}
                                      </span>
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => removeOperation(operation.id)}
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[#9A3D2F] hover:bg-[#FFF4F1]"
                                    aria-label={t('sewing.action.remove')}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-[8px] border border-dashed border-[#D9D5CC] bg-white px-3 py-4 text-center text-[9px] text-[#918D84]">{pfUiT("ui.components.workspace.b8c4fd6186")}</div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}

              {!constructionSteps.length && (
                <div className="rounded-[10px] border border-dashed border-[#D9D5CC] bg-[#FCFBF8] px-4 py-8 text-center text-[10px] text-[#6F6C65]">
                  {t('sewing.construction.empty')}
                </div>
              )}
            </div>
          </section>

          <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
            <section className="min-h-0 flex-1 overflow-y-auto rounded-[12px] border border-[#E5E2DA] bg-white p-3">
              {selectedOperation ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[#9A9186]">{pfUiT("ui.components.workspace.7a73577383")}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="flex h-7 min-w-10 items-center justify-center rounded-[7px] bg-[#F1EEE8] px-2 font-mono text-[10px] font-semibold text-[#6F5A42]">
                          {selectedOperation.step || '--'}
                        </span>
                        <h3 className="truncate text-[12px] font-semibold text-[#272622]">
                          {selectedOperation.op || t('sewing.field.operation')}
                        </h3>
                        {selectedOperation.standardStatus && selectedOperation.standardStatus !== 'DRAFT' && (
                          <span className="rounded-full bg-[#F1EEE8] px-2 py-1 text-[8px] font-semibold text-[#6F6C65]">
                            {selectedOperation.standardStatus}
                          </span>
                        )}
                      </div>
                      {selectedConstructionStep?.title && (
                        <p className="mt-1 text-[8px] text-[#918D84]">
                          Construction: {selectedConstructionStep.title}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedOperationId('')}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[#918D84] hover:bg-[#F4F2ED] hover:text-[#272622]"
                      aria-label={pfUiT("ui.components.workspace.5424901296")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {operationEditableFields.map((field) => (
                      <label
                        key={`operation-editor-${selectedOperation.id}-${field.key}`}
                        className={['op', 'notes'].includes(field.key) ? 'sm:col-span-2' : ''}
                      >
                        <span className="mb-1 block text-[8px] font-semibold uppercase tracking-[0.08em] text-[#6F6C65]">
                          {t(field.labelKey)}
                        </span>
                        <ConstructionFieldControl
                          field={field}
                          value={selectedOperation[field.key]}
                          t={t}
                          onChange={(value) =>
                            patchOperation(selectedOperation.id, {
                              [field.key]: value
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                </>
              ) : selectedConstructionStep ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[#9A9186]">{pfUiT("ui.components.workspace.3932b2cccd")}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="flex h-7 min-w-8 items-center justify-center rounded-[7px] bg-[#F1EEE8] px-2 font-mono text-[10px] font-semibold text-[#6F5A42]">
                          {String(selectedConstructionStep.order || 1).padStart(2, '0')}
                        </span>
                        <h3 className="truncate text-[12px] font-semibold text-[#272622]">
                          {selectedConstructionStep.title || t('sewing.field.instruction')}
                        </h3>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedConstructionStepId('');
                        setSelectedOperationId('');
                      }}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[#918D84] hover:bg-[#F4F2ED] hover:text-[#272622]"
                      aria-label={pfUiT("ui.components.workspace.1413ee80ae")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {constructionGridFields
                      .filter((field) => field.key !== 'order')
                      .map((field) => (
                        <label
                          key={`editor-${selectedConstructionStep.id}-${field.key}`}
                          className={field.key === 'title' ? 'sm:col-span-2' : ''}
                        >
                          <span className="mb-1 block text-[8px] font-semibold uppercase tracking-[0.08em] text-[#6F6C65]">
                            {t(field.labelKey)}
                          </span>
                          <ConstructionFieldControl
                            field={field}
                            value={selectedConstructionStep[field.key]}
                            t={t}
                            onChange={(value) =>
                              patchConstructionStep(selectedConstructionStep.id, {
                                [field.key]: value
                              })
                            }
                          />
                        </label>
                      ))}
                  </div>

                  {constructionDetailFields.map((field) => (
                    <label
                      key={`editor-detail-${selectedConstructionStep.id}-${field.key}`}
                      className="mt-2 block"
                    >
                      <span className="mb-1 block text-[8px] font-semibold uppercase tracking-[0.08em] text-[#6F6C65]">
                        {t(field.labelKey)}
                      </span>
                      <ConstructionFieldControl
                        field={{ ...field, rows: Math.min(field.rows || 3, 3) }}
                        value={selectedConstructionStep[field.key]}
                        t={t}
                        onChange={(value) =>
                          patchConstructionStep(selectedConstructionStep.id, {
                            [field.key]: value
                          })
                        }
                      />
                    </label>
                  ))}

                  <div className="mt-3 border-t border-[#EEEAE2] pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="text-[10px] font-semibold text-[#272622]">
                          {t('sewing.requirements.title')}
                        </h4>
                        <p className="mt-0.5 text-[8px] text-[#918D84]">{pfUiT("ui.components.workspace.ee1d33a21f")}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addConstructionRequirement(selectedConstructionStep.id)}
                        className="inline-flex h-7 items-center gap-1 rounded-[7px] border border-[#D9D5CC] bg-white px-2 text-[8px] font-semibold text-[#4A4741] hover:bg-[#F4F2ED]"
                      >
                        <Plus className="h-3 w-3" />
                        {t('sewing.action.addRequirement')}
                      </button>
                    </div>

                    <div className="mt-2 space-y-1.5">
                      {getConstructionRequirements(selectedConstructionStep).map((requirement) => (
                        <div
                          key={requirement.id}
                          className="rounded-[8px] border border-[#E5E2DA] bg-[#FCFBF8] p-2"
                        >
                          <div className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_100px_28px]">
                            {constructionRequirementFields
                              .filter((field) => field.key !== 'notes')
                              .map((field) => (
                                <input
                                  key={`${requirement.id}-${field.key}`}
                                  value={requirement[field.key] || ''}
                                  onChange={(event) =>
                                    patchConstructionRequirement(
                                      selectedConstructionStep.id,
                                      requirement.id,
                                      { [field.key]: event.target.value }
                                    )
                                  }
                                  aria-label={t(field.labelKey)}
                                  placeholder={t(field.labelKey)}
                                  className={subtleInputClass}
                                />
                              ))}

                            <button
                              type="button"
                              onClick={() =>
                                removeConstructionRequirement(
                                  selectedConstructionStep.id,
                                  requirement.id
                                )
                              }
                              className="flex h-8 w-7 items-center justify-center rounded-[7px] text-[#9A3D2F] hover:bg-[#FFF4F1]"
                              aria-label={t('sewing.action.remove')}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>

                          {constructionRequirementFields
                            .filter((field) => field.key === 'notes')
                            .map((field) => (
                              <input
                                key={`${requirement.id}-${field.key}`}
                                value={requirement[field.key] || ''}
                                onChange={(event) =>
                                  patchConstructionRequirement(
                                    selectedConstructionStep.id,
                                    requirement.id,
                                    { [field.key]: event.target.value }
                                  )
                                }
                                aria-label={t(field.labelKey)}
                                placeholder={t(field.labelKey)}
                                className={`${subtleInputClass} mt-1.5`}
                              />
                            ))}
                        </div>
                      ))}

                      {!getConstructionRequirements(selectedConstructionStep).length && (
                        <div className="rounded-[8px] border border-dashed border-[#D9D5CC] bg-[#FCFBF8] px-3 py-4 text-center text-[9px] text-[#918D84]">{pfUiT("ui.components.workspace.8906fe07d3")}</div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full min-h-[260px] items-center justify-center rounded-[9px] border border-dashed border-[#D9D5CC] bg-[#FCFBF8] px-4 text-center">
                  <div>
                    <Scissors className="mx-auto h-6 w-6 text-[#B5ADA2]" />
                    <p className="mt-2 text-[10px] font-semibold text-[#6F6C65]">{pfUiT("ui.components.workspace.8b3214b573")}</p>
                    <p className="mt-1 text-[9px] leading-relaxed text-[#918D84]">{pfUiT("ui.components.workspace.53ae024066")}</p>
                  </div>
                </div>
              )}
            </section>

            <section className="shrink-0 rounded-[12px] border border-[#E5E2DA] bg-white p-3">
              <label className="block text-[9px] font-semibold uppercase tracking-[0.08em] text-[#6F6C65]">
                {t('sewing.allowance.title')}
              </label>
              <textarea
                value={values.seamAllowances || ''}
                onChange={(event) => persistSewing({ seamAllowances: event.target.value })}
                rows={2}
                className="mt-1.5 h-[58px] w-full resize-none rounded-[8px] border border-[#E5E2DA] px-2.5 py-2 text-[9px] leading-relaxed"
              />
            </section>
          </div>
        </div>
      )}

      {activeTab === 'TIME_MOTION' && (
        <TimeAndMotionStudy
          metadata={metadata}
          t={t}
          operations={operations}
          onOperationsChange={(nextOperations) => persistSewing({ operations: nextOperations })}
          studyData={studyData}
          onStudyDataChange={(nextStudyData) => persistSewing({ timeMotion: nextStudyData })}
          activePatternId={workspacePattern.id}
          designerCode={project?.values?.['project.designer_code'] || ''}
          patternName={workspacePattern.name}
        />
      )}

      {activeTab === 'QUALITY' && (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
          <section className="rounded-[12px] border border-[#E5E2DA] bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-[13px] font-semibold text-[#272622]">{t('sewing.quality.title')}</h3>
                <p className="mt-0.5 text-[10px] text-[#6F6C65]">{t('sewing.quality.subtitle')}</p>
              </div>
              <button
                type="button"
                onClick={addQualityCheck}
                className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-[#272622] px-3 text-[9px] font-semibold text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('sewing.quality.add')}
              </button>
            </div>

            <div className="mt-3 max-h-[500px] space-y-1.5 overflow-auto">
              {qualityChecks.map((check) => (
                <div
                  key={check.id}
                  className="grid gap-1.5 rounded-[8px] border border-[#E5E2DA] bg-[#FCFBF8] p-2 md:grid-cols-[minmax(160px,1fr)_130px_minmax(180px,1fr)_32px]"
                >
                  <input
                    value={check.checkpoint || ''}
                    onChange={(event) => patchQualityCheck(check.id, { checkpoint: event.target.value })}
                    placeholder={t('sewing.quality.checkpoint')}
                    className="h-8 rounded-[7px] border border-[#E5E2DA] bg-white px-2 text-[9px]"
                  />
                  <input
                    value={check.tolerance || ''}
                    onChange={(event) => patchQualityCheck(check.id, { tolerance: event.target.value })}
                    placeholder={t('sewing.quality.tolerance')}
                    className="h-8 rounded-[7px] border border-[#E5E2DA] bg-white px-2 text-[9px]"
                  />
                  <input
                    value={check.notes || ''}
                    onChange={(event) => patchQualityCheck(check.id, { notes: event.target.value })}
                    placeholder={t('sewing.field.note')}
                    className="h-8 rounded-[7px] border border-[#E5E2DA] bg-white px-2 text-[9px]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      persistSewing({
                        qualityChecks: qualityChecks.filter((entry) => entry.id !== check.id)
                      })
                    }
                    className="flex h-8 w-8 items-center justify-center text-[#9A3D2F]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {!qualityChecks.length && (
                <div className="rounded-[8px] border border-dashed border-[#D9D5CC] px-4 py-8 text-center text-[10px] text-[#6F6C65]">
                  {t('sewing.quality.empty')}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[12px] border border-[#E5E2DA] bg-white p-3">
            <label className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#6F6C65]">
              {t('sewing.quality.notes')}
            </label>
            <textarea
              value={values.qualityNotes || ''}
              onChange={(event) => persistSewing({ qualityNotes: event.target.value })}
              rows={10}
              className="mt-1.5 min-h-[220px] w-full resize-y rounded-[8px] border border-[#E5E2DA] px-2.5 py-2 text-[9px] leading-relaxed"
            />
          </section>
        </div>
      )}
    </div>
  );
}


function TechPackModule({
  metadata,
  node,
  variant,
  style,
  project,
  onChange,
  onNavigateModule,
  onOpenCompanion,
  t
}) {
  const workspacePattern = useMemo(
    () => buildWorkspaceLegacyPattern({ metadata, variant, style, project, t }),
    [metadata, project, style, t, variant]
  );

  return (
    <TechPackWorkspace
      metadata={metadata}
      node={node}
      variant={variant}
      style={style}
      project={project}
      onChange={onChange}
      onNavigateModule={onNavigateModule}
      onOpenCompanion={onOpenCompanion}
      industrialContent={(
        <div className="rounded-[14px] border border-[#E5E2DA] bg-white p-3 shadow-sm">
          <IndustrialTechPack pattern={workspacePattern} />
        </div>
      )}
    />
  );
}


function WorkspaceCompanionWindow({
  metadata,
  panelConfig,
  panelState,
  variant,
  style,
  project,
  currentUser,
  onChange,
  onPatch,
  onBringFront,
  onMinimize,
  onClose,
  onOpenFull,
  t
}) {
  const panelRef = useRef(null);
  const interactionRef = useRef(null);

  const sourceNode = useMemo(
    () =>
      (variant?.children || []).find(
        (child) => child.nodeType === panelConfig.nodeType
      ) || null,
    [panelConfig.nodeType, variant]
  );

  const Icon = getNodeIcon(metadata, panelConfig.nodeType);

  useEffect(() => {
    const handleMove = (event) => {
      const interaction = interactionRef.current;
      if (!interaction) return;

      if (interaction.mode === 'move') {
        const width = panelState.width || 700;
        const height = panelState.height || 560;
        const maxX = Math.max(8, window.innerWidth - Math.min(width, window.innerWidth - 16) - 8);
        const maxY = Math.max(8, window.innerHeight - 72);

        onPatch({
          x: Math.min(
            Math.max(8, interaction.startLeft + (event.clientX - interaction.startX)),
            maxX
          ),
          y: Math.min(
            Math.max(8, interaction.startTop + (event.clientY - interaction.startY)),
            maxY
          )
        });
        return;
      }

      if (interaction.mode === 'resize') {
        const maxWidth = Math.max(420, window.innerWidth - panelState.x - 12);
        const maxHeight = Math.max(320, window.innerHeight - panelState.y - 12);

        onPatch({
          width: Math.min(
            maxWidth,
            Math.max(460, interaction.startWidth + (event.clientX - interaction.startX))
          ),
          height: Math.min(
            maxHeight,
            Math.max(340, interaction.startHeight + (event.clientY - interaction.startY))
          )
        });
      }
    };

    const handleUp = () => {
      interactionRef.current = null;
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [onPatch, panelState.height, panelState.width, panelState.x, panelState.y]);

  if (!panelState.open || panelState.minimized) {
    return null;
  }

  const beginMove = (event) => {
    if (event.button !== 0 || panelState.maximized) return;
    if (event.target.closest('button, input, select, textarea, a')) return;

    onBringFront();
    interactionRef.current = {
      mode: 'move',
      startX: event.clientX,
      startY: event.clientY,
      startLeft: panelState.x,
      startTop: panelState.y
    };
  };

  const beginResize = (event) => {
    if (panelState.maximized) return;
    event.preventDefault();
    event.stopPropagation();
    onBringFront();

    interactionRef.current = {
      mode: 'resize',
      startX: event.clientX,
      startY: event.clientY,
      startWidth: panelState.width,
      startHeight: panelState.height
    };
  };

  const toggleMaximize = () => {
    if (panelState.maximized) {
      const restore = panelState.restore || {};
      onPatch({
        maximized: false,
        x: restore.x ?? 80,
        y: restore.y ?? 100,
        width: restore.width ?? 700,
        height: restore.height ?? 560,
        restore: null
      });
      return;
    }

    const rect = panelRef.current?.getBoundingClientRect();
    onPatch({
      maximized: true,
      restore: {
        x: panelState.x,
        y: panelState.y,
        width: rect?.width || panelState.width,
        height: rect?.height || panelState.height
      },
      x: 14,
      y: 14,
      width: Math.max(520, window.innerWidth - 28),
      height: Math.max(420, window.innerHeight - 28)
    });
  };

  const renderContent = () => {
    if (!sourceNode) {
      return (
        <div className="workspace-companion-empty">
          <Icon className="h-6 w-6" />
          <strong>{panelConfig.label}</strong>
          <span>{pfUiT("ui.components.workspace.2eaba241c2")}</span>
        </div>
      );
    }

    if (panelConfig.nodeType === 'sewing') {
      return (
        <SewingModule
          metadata={metadata}
          node={sourceNode}
          variant={variant}
          style={style}
          project={project}
          onChange={onChange}
          t={t}
        />
      );
    }

    if (panelConfig.nodeType === 'sizeSet') {
      return (
        <MeasurementChartModule
          metadata={metadata}
          node={sourceNode}
          variant={variant}
          style={style}
          currentUser={currentUser}
          onChange={onChange}
          t={t}
        />
      );
    }

    if (panelConfig.nodeType === 'projectJournal') {
      return (
        <ProjectJournalWorkspaceModule
          metadata={metadata}
          node={sourceNode}
          variant={variant}
          style={style}
          project={project}
          currentUser={currentUser}
          onChange={onChange}
          t={t}
        />
      );
    }

    return (
      <div className="workspace-companion-empty">
        <Icon className="h-6 w-6" />
        <strong>{panelConfig.label}</strong>
        <span>{pfUiT("ui.components.workspace.c5c633badd")}</span>
      </div>
    );
  };

  return (
    <section
      ref={panelRef}
      className={`workspace-companion-window ${panelState.maximized ? 'is-maximized' : ''}`}
      style={{
        left: `${panelState.x}px`,
        top: `${panelState.y}px`,
        width: `${panelState.width}px`,
        height: `${panelState.height}px`,
        zIndex: panelState.z
      }}
      onPointerDown={onBringFront}
    >
      <header
        className="workspace-companion-header"
        onPointerDown={beginMove}
      >
        <div className="workspace-companion-heading">
          <span className="workspace-companion-icon">
            <Icon aria-hidden="true" />
          </span>
          <div>
            <strong>{panelConfig.label}</strong>
            <small>{variant?.values?.['variant.code'] || 'Workspace companion'}</small>
          </div>
        </div>

        <div className="workspace-companion-actions">
          <button
            type="button"
            onClick={onMinimize}
            title={pfUiT("ui.components.workspace.790832a7e2")}
            aria-label={`Minimize ${panelConfig.label}`}
          >
            <Minus />
          </button>
          <button
            type="button"
            onClick={toggleMaximize}
            title={panelState.maximized ? 'Restore' : 'Maximize'}
            aria-label={`${panelState.maximized ? 'Restore' : 'Maximize'} ${panelConfig.label}`}
          >
            {panelState.maximized ? <Minimize2 /> : <Maximize2 />}
          </button>
          <button
            type="button"
            onClick={() => onOpenFull(panelConfig.nodeType)}
            title={pfUiT("ui.components.workspace.bf7006500c")}
            aria-label={`Open full ${panelConfig.label}`}
          >
            <ExternalLink />
          </button>
          <button
            type="button"
            onClick={onClose}
            title={pfUiT("ui.components.workspace.c604306cc7")}
            aria-label={`Close ${panelConfig.label}`}
          >
            <X />
          </button>
        </div>
      </header>

      <div className="workspace-companion-body">
        {renderContent()}
      </div>

      {!panelState.maximized && (
        <button
          type="button"
          className="workspace-companion-resize-handle"
          onPointerDown={beginResize}
          aria-label={`Resize ${panelConfig.label}`}
          title={pfUiT("ui.components.workspace.6aab790971")}
        >
          <span />
        </button>
      )}
    </section>
  );
}

function WorkspaceCompanionLayer({
  metadata,
  panels,
  variant,
  style,
  project,
  currentUser,
  onChange,
  onPatchPanel,
  onBringFront,
  onMinimizePanel,
  onRestorePanel,
  onClosePanel,
  onNavigateModule,
  t
}) {
  const configs = metadata.techPack?.ui?.companionPanels || [];
  const minimizedConfigs = configs.filter(
    (config) => panels[config.code]?.open && panels[config.code]?.minimized
  );

  return (
    <>
      {configs.map((config) => {
        const state = panels[config.code];
        if (!state?.open) return null;

        return (
          <WorkspaceCompanionWindow
            key={config.code}
            metadata={metadata}
            panelConfig={config}
            panelState={state}
            variant={variant}
            style={style}
            project={project}
            currentUser={currentUser}
            onChange={onChange}
            onPatch={(patch) => onPatchPanel(config.code, patch)}
            onBringFront={() => onBringFront(config.code)}
            onMinimize={() => onMinimizePanel(config.code)}
            onClose={() => onClosePanel(config.code)}
            onOpenFull={onNavigateModule}
            t={t}
          />
        );
      })}

      {minimizedConfigs.length > 0 && (
        <div className="workspace-companion-dock" aria-label={pfUiT("ui.components.workspace.a2608103df")}>
          {minimizedConfigs.map((config) => {
            const Icon = getNodeIcon(metadata, config.nodeType);
            return (
              <button
                key={config.code}
                type="button"
                onClick={() => onRestorePanel(config.code)}
                title={`Restore ${config.label}`}
              >
                <Icon aria-hidden="true" />
                <span>{config.shortLabel || config.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

function CollaborationShareModal({
  open,
  metadata,
  currentUser,
  selectedPath,
  grants,
  onClose,
  onCreateGrant,
  onRevokeGrant,
  t
}) {
  const actor =
    resolveWorkspaceActor(currentUser);

  const shareScopes =
    metadata.collaboration?.shareScopes || [];

  const availableScopeNodes =
    selectedPath.filter(
      (node) =>
        shareScopes.some(
          (scope) =>
            scope.nodeType ===
            node.nodeType
        )
    );

  const defaultScopeNode =
    availableScopeNodes[
      availableScopeNodes.length - 1
    ] ||
    null;

  const [form, setForm] =
    useState(() => ({
      collaboratorName: '',
      collaboratorLogin: '',
      scopeNodeId:
        defaultScopeNode?.id || '',
      durationType: 'FIXED',
      expiresAt: '',
      roleCode:
        metadata.collaboration?.roles?.[1]?.code ||
        metadata.collaboration?.roles?.[0]?.code ||
        '',
      policyCode: 'DIRECT',
      modulePermissions: {}
    }));

  useEffect(() => {
    if (!open) return;

    const scopeNode =
      availableScopeNodes[
        availableScopeNodes.length - 1
      ];

    const defaultRole =
      metadata.collaboration?.roles?.[1] ||
      metadata.collaboration?.roles?.[0];

    const defaultPermission =
      defaultRole?.defaultPermission ||
      'VIEW';

    const modulePermissions =
      (metadata.collaboration?.delegableModules || [])
        .reduce(
          (result, module) => ({
            ...result,
            [module.nodeType]:
              defaultPermission
          }),
          {}
        );

    setForm({
      collaboratorName: '',
      collaboratorLogin: '',
      scopeNodeId:
        scopeNode?.id || '',
      durationType: 'FIXED',
      expiresAt: '',
      roleCode:
        defaultRole?.code || '',
      policyCode: 'DIRECT',
      modulePermissions
    });
  }, [
    open,
    metadata.collaboration,
    selectedPath
  ]);

  if (!open) {
    return null;
  }

  const selectedScopeNode =
    availableScopeNodes.find(
      (node) =>
        node.id ===
        form.scopeNodeId
    ) ||
    defaultScopeNode;

  const selectedScopeType =
    shareScopes.find(
      (scope) =>
        scope.nodeType ===
        selectedScopeNode?.nodeType
    )?.code ||
    'VARIANT';

  const activeGrants =
    (grants || []).filter(
      (grant) =>
        isGrantActive(grant)
    );

  const setRole =
    (roleCode) => {
      const role =
        metadata.collaboration?.roles?.find(
          (item) =>
            item.code ===
            roleCode
        );

      const defaultPermission =
        role?.defaultPermission ||
        'VIEW';

      setForm((current) => ({
        ...current,
        roleCode,
        modulePermissions:
          Object.keys(
            current.modulePermissions
          ).reduce(
            (result, key) => ({
              ...result,
              [key]:
                defaultPermission
            }),
            {}
          )
      }));
    };

  const handleSubmit =
    (event) => {
      event.preventDefault();

      if (
        !form.collaboratorName.trim() ||
        !form.collaboratorLogin.trim() ||
        !selectedScopeNode
      ) {
        return;
      }

      if (
        form.durationType === 'FIXED' &&
        !form.expiresAt
      ) {
        return;
      }

      onCreateGrant({
        owner: actor,
        collaborator: {
          name:
            form.collaboratorName.trim(),
          login:
            form.collaboratorLogin.trim()
        },
        scope: {
          type:
            selectedScopeType,
          nodeType:
            selectedScopeNode.nodeType,
          nodeId:
            selectedScopeNode.id,
          label:
            getNodeTitleFallback(
              selectedScopeNode
            )
        },
        durationType:
          form.durationType,
        expiresAt:
          form.durationType === 'FIXED'
            ? form.expiresAt
            : null,
        roleCode:
          form.roleCode,
        policyCode:
          form.policyCode,
        modulePermissions:
          form.modulePermissions
      });
    };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-[#272622]/40 p-4"
      style={{ zIndex: UI_LAYERS.modalBackdrop }}
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-[14px] border border-[#D9D5CC] bg-[#FCFBF8] shadow-[0_30px_80px_rgba(39,38,34,0.24)]">
        <div className="flex items-start justify-between gap-3 border-b border-[#E5E2DA] px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-[#E5E2DA] bg-white text-[#7B5C49]">
                <Users className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-[16px] font-semibold text-[#272622]">
                  {t('collaboration.title') || 'Project Collaboration'}
                </h3>
                <p className="mt-0.5 text-[11px] text-[#6F6C65]">
                  {t('collaboration.subtitle')}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#6F6C65] hover:bg-[#EFEEE8]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_300px]"
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6F6C65]">
                  {t('collaboration.field.collaboratorName')}
                </span>
                <input
                  value={
                    form.collaboratorName
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        collaboratorName:
                          event.target.value
                      })
                    )
                  }
                  className="h-9 w-full rounded-[9px] border border-[#E5E2DA] bg-white px-3 text-[12px]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6F6C65]">
                  {t('collaboration.field.collaboratorLogin')}
                </span>
                <input
                  value={
                    form.collaboratorLogin
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        collaboratorLogin:
                          event.target.value
                      })
                    )
                  }
                  className="h-9 w-full rounded-[9px] border border-[#E5E2DA] bg-white px-3 text-[12px]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6F6C65]">
                  {t('collaboration.field.scope')}
                </span>
                <select
                  value={
                    form.scopeNodeId
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        scopeNodeId:
                          event.target.value
                      })
                    )
                  }
                  className="h-9 w-full rounded-[9px] border border-[#E5E2DA] bg-white px-3 text-[12px]"
                >
                  {availableScopeNodes.map(
                    (node) => (
                      <option
                        key={node.id}
                        value={node.id}
                      >
                        {node.nodeType === 'project'
                          ? 'Project'
                          : node.nodeType === 'product'
                          ? 'Style'
                          : 'Variant'}
                        {' · '}
                        {getNodeTitleFallback(node)}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6F6C65]">
                  {t('collaboration.field.role')}
                </span>
                <select
                  value={form.roleCode}
                  onChange={(event) =>
                    setRole(
                      event.target.value
                    )
                  }
                  className="h-9 w-full rounded-[9px] border border-[#E5E2DA] bg-white px-3 text-[12px]"
                >
                  {(metadata.collaboration?.roles || []).map(
                    (role) => (
                      <option
                        key={role.code}
                        value={role.code}
                      >
                        {t(role.labelKey)}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6F6C65]">
                  {t('collaboration.field.duration')}
                </span>
                <select
                  value={
                    form.durationType
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        durationType:
                          event.target.value
                      })
                    )
                  }
                  className="h-9 w-full rounded-[9px] border border-[#E5E2DA] bg-white px-3 text-[12px]"
                >
                  {(metadata.collaboration?.durations || []).map(
                    (duration) => (
                      <option
                        key={duration.code}
                        value={duration.code}
                      >
                        {t(duration.labelKey)}
                      </option>
                    )
                  )}
                </select>
              </label>

              {form.durationType === 'FIXED' && (
                <label className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6F6C65]">
                    {t('collaboration.field.expiresAt')}
                  </span>
                  <input
                    type="date"
                    value={form.expiresAt}
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          expiresAt:
                            event.target.value
                        })
                      )
                    }
                    className="h-9 w-full rounded-[9px] border border-[#E5E2DA] bg-white px-3 text-[12px]"
                  />
                </label>
              )}

              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6F6C65]">
                  {t('collaboration.field.policy')}
                </span>
                <select
                  value={
                    form.policyCode
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        policyCode:
                          event.target.value
                      })
                    )
                  }
                  className="h-9 w-full rounded-[9px] border border-[#E5E2DA] bg-white px-3 text-[12px]"
                >
                  {(metadata.collaboration?.policies || []).map(
                    (policy) => (
                      <option
                        key={policy.code}
                        value={policy.code}
                      >
                        {t(policy.labelKey)}
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>

            <div className="rounded-[10px] border border-[#E5E2DA] bg-white p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6F6C65]">
                {t('collaboration.modules')}
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(metadata.collaboration?.delegableModules || []).map(
                  (module) => (
                    <label
                      key={module.nodeType}
                      className="flex items-center justify-between gap-2 rounded-[9px] border border-[#EEEAE2] bg-[#F8F7F3] px-3 py-2"
                    >
                      <span className="text-[11px] font-medium text-[#272622]">
                        {t(module.labelKey)}
                      </span>

                      <select
                        value={
                          form.modulePermissions[
                            module.nodeType
                          ] ||
                          'NONE'
                        }
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              modulePermissions: {
                                ...current.modulePermissions,
                                [module.nodeType]:
                                  event.target.value
                              }
                            })
                          )
                        }
                        className="rounded-[8px] border border-[#D9D5CC] bg-white px-2 py-1 text-[10px]"
                      >
                        {(metadata.collaboration?.permissions || []).map(
                          (permission) => (
                            <option
                              key={permission.code}
                              value={permission.code}
                            >
                              {t(permission.labelKey)}
                            </option>
                          )
                        )}
                      </select>
                    </label>
                  )
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[9px] border border-[#D9D5CC] px-3.5 py-2 text-[12px] font-semibold text-[#4A4741] hover:bg-[#EFEEE8]"
              >{pfUiT("ui.components.workspace.3e708f4001")}</button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-[9px] bg-[#272622] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#3A3934]"
              >
                <Share2 className="h-3.5 w-3.5" />{pfUiT("ui.components.workspace.9fdea67acb")}</button>
            </div>
          </div>

          <aside className="rounded-[10px] border border-[#E5E2DA] bg-[#F8F7F3] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6F6C65]">
                {t('collaboration.grants')}
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-[#6F6C65]">
                {activeGrants.length}
              </span>
            </div>

            <div className="mt-2 max-h-[460px] space-y-2 overflow-auto">
              {activeGrants.map(
                (grant) => (
                  <div
                    key={grant.id}
                    className="rounded-[9px] border border-[#E5E2DA] bg-white px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-semibold text-[#272622]">
                          {grant.collaborator?.name}
                        </div>
                        <div className="truncate text-[10px] text-[#918D84]">
                          {grant.collaborator?.login}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onRevokeGrant(
                            grant.id
                          )
                        }
                        className="rounded-[7px] border border-[#E8C9C1] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#9A3D2F] hover:bg-[#FFF7F5]"
                      >{pfUiT("ui.components.workspace.682f66fd10")}</button>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="rounded-full bg-[#F4F2ED] px-2 py-0.5 text-[9px] text-[#6F6C65]">
                        {grant.scope?.type}
                      </span>
                      <span className="rounded-full bg-[#F4F2ED] px-2 py-0.5 text-[9px] text-[#6F6C65]">
                        {grant.roleCode}
                      </span>
                      <span className="rounded-full bg-[#F4F2ED] px-2 py-0.5 text-[9px] text-[#6F6C65]">
                        {grant.policyCode}
                      </span>
                    </div>

                    <div className="mt-1.5 truncate text-[10px] text-[#6F6C65]">
                      {grant.scope?.label}
                    </div>

                    <div className="mt-1 text-[9px] text-[#918D84]">
                      {grant.durationType === 'PERMANENT'
                        ? 'Permanent until revoked'
                        : `Until ${grant.expiresAt || '—'}`}
                    </div>
                  </div>
                )
              )}

              {!activeGrants.length && (
                <div className="rounded-[9px] border border-dashed border-[#D9D5CC] bg-white px-3 py-5 text-center text-[11px] text-[#6F6C65]">{pfUiT("ui.components.workspace.81760aff52")}</div>
              )}
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}

function EntityModal({
  metadata,
  state,
  onClose,
  onSubmit,
  t
}) {
  const [values, setValues] = useState(() => cloneValue(state?.values || {}));
  const [error, setError] = useState('');

  if (!state) return null;

  const tempNode = {
    nodeType: state.nodeType,
    values
  };
  const title = `${state.mode === 'edit' ? 'Edit' : 'Create'} ${state.label}`;
  const nameFieldKey = state.nodeType === 'project'
    ? 'project.name'
    : state.nodeType === 'product'
      ? 'product.style_name'
      : 'variant.name';

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');

    if (!String(values[nameFieldKey] || '').trim()) {
      setError('Name is required.');
      return;
    }

    onSubmit(values);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-[#272622]/35 p-4"
      style={{ zIndex: UI_LAYERS.modalBackdrop }}
    >
      <form onSubmit={handleSubmit} className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-[14px] border border-[#D9D5CC] bg-[#FCFBF8] shadow-[0_30px_80px_rgba(39,38,34,0.22)]">
        <div className="flex items-center justify-between border-b border-[#E5E2DA] px-5 py-4">
          <h3 className="text-[16px] font-semibold text-[#272622]">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#6F6C65] hover:bg-[#EFEEE8]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">
          <MetadataForm
            metadata={metadata}
            node={tempNode}
            t={t}
            onFieldChange={(fieldKey, value) => setValues((current) => ({
              ...current,
              [fieldKey]: value
            }))}
          />
          {error && (
            <div className="mt-4 rounded-[10px] border border-[#E8C9C1] bg-[#FFF7F5] px-3 py-2 text-[12px] text-[#9A3D2F]">{error}</div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#E5E2DA] px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-[9px] border border-[#D9D5CC] px-3.5 py-2 text-[12px] font-semibold text-[#4A4741] hover:bg-[#EFEEE8]">{pfUiT("ui.components.workspace.3e708f4001")}</button>
          <button type="submit" className="rounded-[9px] bg-[#272622] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#3A3934]">{pfUiT("ui.components.workspace.6256cd0def")}</button>
        </div>
      </form>
    </div>
  );
}

function ConfirmDeleteModal({
  state,
  onClose,
  onConfirm,
  metadata,
  t
}) {
  if (!state) return null;

  const typeLabel = t(metadata.structure?.treeTypes?.[state.node.nodeType]?.labelKey);
  const title = getNodeTitle(metadata, state.node, t);
  const warning = state.node.nodeType === 'project'
    ? 'Deleting this Project also removes its child Styles and Variants from the current Workspace state.'
    : state.node.nodeType === 'product'
      ? 'Deleting this Style also removes its child Variants from the current Workspace state.'
      : 'Deleting this Variant removes it from the current Workspace state.';

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-[#272622]/35 p-4"
      style={{ zIndex: UI_LAYERS.modalBackdrop }}
    >
      <div className="w-full max-w-md rounded-[14px] border border-[#D9D5CC] bg-[#FCFBF8] shadow-[0_30px_80px_rgba(39,38,34,0.22)]">
        <div className="flex items-start gap-3 border-b border-[#E5E2DA] px-5 py-4">
          <div className="rounded-full bg-[#FFF0EC] p-2 text-[#9A3D2F]">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-[16px] font-semibold text-[#272622]">Delete {typeLabel}</h3>
            <p className="mt-0.5 truncate text-[11px] text-[#6F6C65] sm:text-[12px] xl:mt-1 xl:text-[13px]">{title}</p>
          </div>
        </div>
        <div className="px-5 py-4 text-[13px] leading-relaxed text-[#4A4741]">
          {warning}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#E5E2DA] px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-[9px] border border-[#D9D5CC] px-3.5 py-2 text-[12px] font-semibold text-[#4A4741] hover:bg-[#EFEEE8]">{pfUiT("ui.components.workspace.3e708f4001")}</button>
          <button type="button" onClick={onConfirm} className="rounded-[9px] bg-[#9A3D2F] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#823125]">{pfUiT("ui.components.workspace.73d98ab4c7")}</button>
        </div>
      </div>
    </div>
  );
}

function ModuleNavigation({
  metadata,
  variantNode,
  selectedNodeId,
  onSelect,
  onSave,
  onShare,
  canShare,
  isDirty,
  isSaving,
  saveState,
  surfaceVisibility,
  t
}) {
  if (!variantNode) {
    return null;
  }

  const items = [
    variantNode,
    ...(variantNode.children ||
      [])
  ].filter((node) => isWorkspaceNodeVisible(surfaceVisibility, node.nodeType));

  return (
    <div className="sticky top-0 z-20 hidden items-center gap-3 border-b border-[#E5E2DA] bg-[#FCFBF8]/95 px-5 backdrop-blur xl:flex">
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-1.5 sm:py-2">
        {items.map(
          (node) => {
            const active =
              node.id ===
              selectedNodeId;

            const Icon =
              getNodeIcon(
                metadata,
                node.nodeType
              );

            const typeMetadata =
              metadata.structure
                ?.treeTypes?.[
                node.nodeType
              ];

            return (
              <button
                key={node.id}
                type="button"
                onClick={() =>
                  onSelect(
                    node.id
                  )
                }
                className={`flex h-9 shrink-0 items-center gap-1.5 rounded-[9px] px-2 text-[11px] font-medium transition-colors sm:gap-2 sm:px-3 sm:text-[12px] ${
                  active
                    ? 'bg-[#EFEEE8] text-[#272622]'
                    : 'text-[#6F6C65] hover:bg-[#F4F2ED] hover:text-[#272622]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />

                <span>
                  {t(
                    typeMetadata
                      ?.navigationLabelKey ||
                      typeMetadata
                        ?.labelKey
                  )}
                </span>
              </button>
            );
          }
        )}
      </div>
      {canShare && (
        <button
          type="button"
          onClick={onShare}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[9px] border border-[#D9D5CC] bg-white px-3 text-[12px] font-semibold text-[#4A4741] hover:bg-[#EFEEE8]"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{pfUiT("ui.components.workspace.58db2b6a0b")}</span>
        </button>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={!isDirty || isSaving}
        className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[9px] border px-3 text-[12px] font-semibold transition-colors ${
          isDirty
            ? 'border-[#272622] bg-[#272622] text-white hover:bg-[#3A3934]'
            : 'border-[#D9D5CC] bg-[#F4F2ED] text-[#918D84]'
        } ${isSaving ? 'cursor-wait opacity-80' : ''}`}
      >
        {isSaving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : saveState === 'saved' ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">
          {isSaving ? 'Saving' : saveState === 'saved' && !isDirty ? 'Saved' : 'Save'}
        </span>
      </button>
    </div>
  );
}


function MobileModuleNavigation({
  metadata,
  variantNode,
  selectedNodeId,
  onSelect,
  surfaceVisibility,
  t
}) {
  const [moreOpen, setMoreOpen] = useState(false);

  if (!variantNode) return null;

  const children = (variantNode.children || []).filter((node) =>
    isWorkspaceNodeVisible(surfaceVisibility, node.nodeType)
  );
  const preferredTypes = ['projectJournal', 'sewing', 'media'];
  const preferredChildren = preferredTypes
    .map((nodeType) => children.find((child) => child.nodeType === nodeType))
    .filter(Boolean);

  const primaryItems = [variantNode, ...preferredChildren].filter((node) =>
    isWorkspaceNodeVisible(surfaceVisibility, node.nodeType)
  );
  const primaryIds = new Set(primaryItems.map((item) => item.id));
  const moreItems = children.filter((item) => !primaryIds.has(item.id));
  const moreActive = moreItems.some((item) => item.id === selectedNodeId);

  const renderItem = (node) => {
    const active = node.id === selectedNodeId;
    const Icon = getNodeIcon(metadata, node.nodeType);
    const typeMetadata = metadata.structure?.treeTypes?.[node.nodeType];
    const label = t(
      typeMetadata?.navigationLabelKey ||
      typeMetadata?.labelKey
    );

    return (
      <button
        key={node.id}
        type="button"
        onClick={() => {
          onSelect(node.id);
          setMoreOpen(false);
        }}
        className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[9px] font-semibold transition-colors ${
          active
            ? 'text-[#272622]'
            : 'text-[#918D84]'
        }`}
      >
        <span className={`flex h-8 w-9 items-center justify-center rounded-[9px] ${
          active ? 'bg-[#EFEEE8]' : 'bg-transparent'
        }`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="max-w-full truncate">{label}</span>
      </button>
    );
  };

  return (
    <>
      {moreOpen && (
        <>
          <button
            type="button"
            aria-label={pfUiT("ui.components.workspace.2058574bcf")}
            onClick={() => setMoreOpen(false)}
            className="fixed inset-0 z-40 bg-[#272622]/20 xl:hidden"
          />
          <div className="fixed inset-x-3 bottom-[76px] z-50 max-h-[55dvh] overflow-y-auto rounded-[14px] border border-[#D9D5CC] bg-[#FCFBF8] p-2 shadow-[0_20px_55px_rgba(39,38,34,0.2)] xl:hidden">
            <div className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#918D84]">{pfUiT("ui.components.workspace.90ccb50982")}</div>
            <div className="grid grid-cols-2 gap-1">
              {moreItems.map((node) => {
                const active = node.id === selectedNodeId;
                const Icon = getNodeIcon(metadata, node.nodeType);
                const typeMetadata = metadata.structure?.treeTypes?.[node.nodeType];
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => {
                      onSelect(node.id);
                      setMoreOpen(false);
                    }}
                    className={`flex items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[11px] font-semibold ${
                      active
                        ? 'bg-[#EFEEE8] text-[#272622]'
                        : 'text-[#6F6C65] hover:bg-[#F4F2ED]'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {t(typeMetadata?.navigationLabelKey || typeMetadata?.labelKey)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#D9D5CC] bg-[#FCFBF8]/95 px-1 pb-[max(4px,env(safe-area-inset-bottom))] pt-1 backdrop-blur xl:hidden">
        <div className="mx-auto flex max-w-[560px] items-stretch">
          {primaryItems.map(renderItem)}
          <button
            type="button"
            onClick={() => setMoreOpen((current) => !current)}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[9px] font-semibold ${
              moreOpen || moreActive
                ? 'text-[#272622]'
                : 'text-[#918D84]'
            }`}
          >
            <span className={`flex h-8 w-9 items-center justify-center rounded-[9px] ${
              moreOpen || moreActive ? 'bg-[#EFEEE8]' : 'bg-transparent'
            }`}>
              <MoreHorizontal className="h-4 w-4" />
            </span>
            <span>{pfUiT("ui.components.workspace.ded716bee6")}</span>
          </button>
        </div>
      </nav>
    </>
  );
}

export default function Workspace({
  currentUser,
  metadata = workspaceMetadata,
  moduleRegistry = {},
  surfaceVisibility = null,
  onWorkspaceDataChange
}) {
  const [workspaceData, setWorkspaceData] =
    useState(() =>
      loadWorkspaceData(metadata)
    );

  const [selectedNodeId, setSelectedNodeId] =
    useState(() => {
      const initialData =
        loadWorkspaceData(
          metadata
        );

      const firstProject =
        initialData.projects?.[0];

      const firstStyle =
        firstProject?.children?.[0];

      const firstVariant =
        firstStyle?.children?.find(
          (child) =>
            child.nodeType ===
            'variant'
        );

      return (
        firstVariant?.id ||
        firstStyle?.id ||
        firstProject?.id ||
        null
      );
    });

  const [
    expandedNodes,
    setExpandedNodes
  ] = useState(() => {
    const ids = new Set();

    const collect = (
      nodes = []
    ) => {
      nodes.forEach((node) => {
        const visibleChildren =
          (
            node.children ||
            []
          ).filter(
            (child) =>
              metadata.structure
                ?.treeTypes?.[
                child.nodeType
              ]?.showInTree !==
              false
          );

        if (
          visibleChildren.length
        ) {
          ids.add(node.id);
        }

        collect(
          visibleChildren
        );
      });
    };

    collect(loadWorkspaceData(metadata).projects || []);

    return ids;
  });

  const [treeSearch, setTreeSearch] = useState('');
  const [openMenuNodeId, setOpenMenuNodeId] = useState(null);
  const [entityModal, setEntityModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveState, setSaveState] = useState('clean');
  const [shareOpen, setShareOpen] = useState(false);
  const [messagingOpenRequest, setMessagingOpenRequest] = useState(null);
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);
  const [desktopTreeCollapsed, setDesktopTreeCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      return clientPreferences.getItem('perfectfit_workspace_tree_collapsed_v1') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      clientPreferences.setItem(
        'perfectfit_workspace_tree_collapsed_v1',
        desktopTreeCollapsed ? '1' : '0'
      );
    } catch {}
  }, [desktopTreeCollapsed]);

  const companionZRef = useRef(2200);
  const [companionPanels, setCompanionPanels] = useState({});

  const patchCompanionPanel = (code, patch) => {
    setCompanionPanels((current) => ({
      ...current,
      [code]: {
        ...(current[code] || {}),
        ...patch
      }
    }));
  };

  const bringCompanionFront = (code) => {
    companionZRef.current += 1;
    patchCompanionPanel(code, {
      z: companionZRef.current
    });
  };

  const openWorkspaceCompanion = (code) => {
    const configs = metadata.techPack?.ui?.companionPanels || [];
    const config = configs.find((item) => item.code === code);
    if (!config) return;

    const index = Math.max(0, configs.findIndex((item) => item.code === code));
    companionZRef.current += 1;

    setCompanionPanels((current) => {
      const existing = current[code] || {};
      const width = existing.width || 720;
      const height = existing.height || 580;
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
      const defaultX = Math.max(24, viewportWidth - width - 38 - index * 18);
      const defaultY = Math.min(
        Math.max(74, 92 + index * 28),
        Math.max(74, viewportHeight - 360)
      );

      return {
        ...current,
        [code]: {
          open: true,
          minimized: false,
          maximized: existing.maximized || false,
          restore: existing.restore || null,
          x: existing.x ?? defaultX,
          y: existing.y ?? defaultY,
          width,
          height,
          z: companionZRef.current
        }
      };
    });
  };

  const minimizeWorkspaceCompanion = (code) => {
    patchCompanionPanel(code, { minimized: true });
  };

  const restoreWorkspaceCompanion = (code) => {
    companionZRef.current += 1;
    patchCompanionPanel(code, {
      minimized: false,
      z: companionZRef.current
    });
  };

  const closeWorkspaceCompanion = (code) => {
    patchCompanionPanel(code, {
      open: false,
      minimized: false,
      maximized: false
    });
  };

  const savedBaselineRef = useRef(
    cloneValue(workspaceData)
  );

  const workspaceActor = useMemo(
    () => resolveWorkspaceActor(currentUser),
    [currentUser]
  );

  const activeLocale =
    workspaceData.selectedLocale ||
    metadata.defaultLocale ||
    'en';

  const t = (key) => {
    if (!key) {
      return '';
    }

    return (
      metadata.localePacks?.[
        activeLocale
      ]?.[key] ||
      metadata.localePacks?.[
        metadata.defaultLocale
      ]?.[key] ||
      ''
    );
  };

  const selectedNode =
    useMemo(
      () =>
        findNodeById(
          workspaceData.projects ||
            [],
          selectedNodeId
        ),
      [
        workspaceData.projects,
        selectedNodeId
      ]
    );

  const selectedPath =
    useMemo(
      () =>
        findNodePath(
          workspaceData.projects ||
            [],
          selectedNodeId
        ),
      [
        workspaceData.projects,
        selectedNodeId
      ]
    );

  const projectContext =
    useMemo(
      () =>
        selectedPath.find(
          (node) =>
            node.nodeType ===
            'project'
        ),
      [selectedPath]
    );

  const projectOwnerIdentityId =
    projectContext?.ownership?.ownerIdentityId ||
    projectContext?.values?.['project.owner_identity_id'] ||
    workspaceActor.id;

  const isProjectOwner =
    Boolean(projectContext) &&
    String(projectOwnerIdentityId) ===
      String(workspaceActor.id);

  const styleContext =
    useMemo(
      () =>
        [...selectedPath]
          .reverse()
          .find(
            (node) =>
              node.nodeType ===
              'product'
          ),
      [selectedPath]
    );

  const variantContext =
    useMemo(
      () =>
        [...selectedPath]
          .reverse()
          .find(
            (node) =>
              node.nodeType ===
              'variant'
          ),
      [selectedPath]
    );

  const headerPrimaryAsset =
    useMemo(
      () =>
        getVariantPrimaryMediaAsset(
          variantContext
        ),
      [variantContext]
    );

  const [
    headerPrimaryObjectUrl,
    setHeaderPrimaryObjectUrl
  ] = useState('');

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';

    setHeaderPrimaryObjectUrl('');

    if (
      !headerPrimaryAsset?.id ||
      headerPrimaryAsset.previewUrl ||
      headerPrimaryAsset.url
    ) {
      return undefined;
    }

    loadMediaFile(headerPrimaryAsset.id)
      .then((file) => {
        if (!file || cancelled) return;

        objectUrl = URL.createObjectURL(file);
        setHeaderPrimaryObjectUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setHeaderPrimaryObjectUrl('');
        }
      });

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [
    headerPrimaryAsset?.id,
    headerPrimaryAsset?.previewUrl,
    headerPrimaryAsset?.url
  ]);

  const headerPrimaryMediaSource =
    headerPrimaryAsset?.previewUrl ||
    headerPrimaryAsset?.url ||
    headerPrimaryObjectUrl;

  const selectedTypeMetadata =
    metadata.structure
      ?.treeTypes?.[
      selectedNode?.nodeType
    ];

  const panelMetadata =
    metadata.structure?.panels?.[
      selectedNode?.nodeType
    ];

  const componentKey =
    selectedNode?.componentKey ||
    panelMetadata?.componentKey ||
    selectedTypeMetadata?.componentKey;

  const effectiveModuleRegistry = useMemo(
    () => ({
      projectJournal: ProjectJournalWorkspaceModule,
      patternLibrary: PatternLibraryModule,
      sizeSet: MeasurementChartModule,
      changeHistory: ChangeHistoryModule,
      sewing: SewingModule,
      techpack: TechPackModule,
      techPack: TechPackModule,
      ...moduleRegistry
    }),
    [moduleRegistry]
  );

  const ModuleComponent =
    componentKey
      ? effectiveModuleRegistry[
          componentKey
        ]
      : null;

  const selectedSurfaceHidden =
    Boolean(selectedNode) &&
    !isWorkspaceNodeVisible(
      surfaceVisibility,
      selectedNode.nodeType
    );

  const storageKey =
    metadata.storageKey ||
    `perfectfit_workspace_data_${metadata.version || 'v1'}`;

  const markDirty = () => {
    setIsDirty(true);
    setSaveState('dirty');
  };

  const persistWorkspaceData = (data = workspaceData) => {
    try {
      runtimeDataStorage.setItem(
        storageKey,
        JSON.stringify(data)
      );
    } catch {}

    try {
      window.dispatchEvent(
        new CustomEvent(
          WORKSPACE_PRESENTATION_UPDATED_EVENT,
          {
            detail: {
              storageKey,
              data
            }
          }
        )
      );
    } catch {}

    if (onWorkspaceDataChange) {
      onWorkspaceDataChange(data);
    }
  };

  const handleSaveWorkspace = () => {
    if (!isDirty || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveState('saving');

    window.setTimeout(() => {
      const auditEntries =
        buildWorkspaceAuditChanges(
          savedBaselineRef.current,
          workspaceData,
          workspaceActor
        );

      const nextData = {
        ...workspaceData,
        auditLog: [
          ...auditEntries,
          ...(workspaceData.auditLog || [])
        ]
      };

      persistWorkspaceData(nextData);
      setWorkspaceData(nextData);
      savedBaselineRef.current =
        cloneValue(nextData);
      setIsDirty(false);
      setIsSaving(false);
      setSaveState('saved');
    }, 180);
  };

  const handleCreateCollaborationGrant = (grantInput) => {
    if (isDirty) return;

    const grant = {
      id: `grant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...grantInput,
      status: 'ACTIVE',
      createdAt: getNowIso(),
      createdBy: workspaceActor
    };

    setWorkspaceData((current) => {
      const nextData = {
        ...current,
        collaboration: {
          ...(current.collaboration || {}),
          grants: [
            grant,
            ...(current.collaboration?.grants || [])
          ]
        },
        auditLog: [
          {
            id: `audit-collab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            changeSetId: `collab-${grant.id}`,
            actor: workspaceActor,
            resource: {
              projectId: projectContext?.id || null,
              styleId: styleContext?.id || null,
              variantId: variantContext?.id || null,
              nodeId: grant.scope?.nodeId || null,
              nodeType: grant.scope?.nodeType || null,
              module: 'collaboration'
            },
            field: 'collaboration.grant',
            operation: 'CREATE',
            previousValue: null,
            newValue: {
              collaborator: grant.collaborator,
              scope: grant.scope,
              durationType: grant.durationType,
              expiresAt: grant.expiresAt,
              roleCode: grant.roleCode,
              policyCode: grant.policyCode,
              modulePermissions: grant.modulePermissions
            },
            source: 'COLLABORATION',
            authorization: {
              mode: 'PROJECT_OWNER',
              grantId: grant.id,
              changeRequestId: null
            },
            createdAt: getNowIso()
          },
          ...(current.auditLog || [])
        ]
      };

      persistWorkspaceData(nextData);
      savedBaselineRef.current =
        cloneValue(nextData);

      return nextData;
    });

    setIsDirty(false);
    setSaveState('saved');
  };

  const handleRevokeCollaborationGrant = (grantId) => {
    if (isDirty) return;

    setWorkspaceData((current) => {
      const grant =
        current.collaboration?.grants?.find(
          (item) =>
            item.id ===
            grantId
        );

      if (!grant) {
        return current;
      }

      const revokedAt =
        getNowIso();

      const nextData = {
        ...current,
        collaboration: {
          ...(current.collaboration || {}),
          grants:
            (current.collaboration?.grants || []).map(
              (item) =>
                item.id === grantId
                  ? {
                      ...item,
                      status: 'REVOKED',
                      revokedAt,
                      revokedBy:
                        workspaceActor
                    }
                  : item
            )
        },
        auditLog: [
          {
            id: `audit-collab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            changeSetId: `collab-${grantId}-revoke`,
            actor: workspaceActor,
            resource: {
              projectId: projectContext?.id || null,
              styleId: styleContext?.id || null,
              variantId: variantContext?.id || null,
              nodeId:
                grant.scope?.nodeId || null,
              nodeType:
                grant.scope?.nodeType || null,
              module:
                'collaboration'
            },
            field:
              'collaboration.grant.status',
            operation: 'UPDATE',
            previousValue: 'ACTIVE',
            newValue: 'REVOKED',
            source: 'COLLABORATION',
            authorization: {
              mode: 'PROJECT_OWNER',
              grantId,
              changeRequestId: null
            },
            createdAt: revokedAt
          },
          ...(current.auditLog || [])
        ]
      };

      persistWorkspaceData(nextData);
      savedBaselineRef.current =
        cloneValue(nextData);

      return nextData;
    });

    setIsDirty(false);
    setSaveState('saved');
  };

  const handleToggleNode = (
    nodeId
  ) => {
    setExpandedNodes(
      (current) => {
        const next =
          new Set(current);

        if (
          next.has(nodeId)
        ) {
          next.delete(nodeId);
        } else {
          next.add(nodeId);
        }

        return next;
      }
    );
  };

  const handleSelectNode = (
    nodeId
  ) => {
    setSelectedNodeId(nodeId);
    setMobileTreeOpen(false);

    const path =
      findNodePath(
        workspaceData.projects ||
          [],
        nodeId
      );

    setExpandedNodes(
      (current) => {
        const next =
          new Set(current);

        path.forEach(
          (node) => {
            next.add(node.id);
          }
        );

        return next;
      }
    );
  };

  const handleFieldChange = (
    fieldKey,
    value,
    targetNodeId,
    replacementValues
  ) => {
    const targetId = targetNodeId || selectedNode?.id;

    if (!targetId) {
      return;
    }

    markDirty();
    setWorkspaceData(
      (current) => ({
        ...current,

        projects:
          updateNodeById(
            current.projects ||
              [],
            targetId,
            (node) => ({
              ...node,

              values:
                fieldKey === '__replaceValues'
                  ? {
                      ...(replacementValues || {})
                    }
                  : {
                      ...(node.values ||
                        {}),
                      [fieldKey]:
                        value
                    }
            })
          )
      })
    );
  };

  const commitIntegrationData = (transform) => {
    setWorkspaceData((current) => {
      const nextData = transform(current);
      persistWorkspaceData(nextData);
      savedBaselineRef.current = cloneValue(nextData);
      return nextData;
    });
    setIsDirty(false);
    setSaveState('saved');
  };

  const handleIntegrationChange = (link, targetVariantId = variantContext?.id) => {
    if (!targetVariantId) return;
    commitIntegrationData((current) =>
      applyEipSharedPatch(current, {
        variantId: targetVariantId,
        link: link
          ? { ...link, status: 'LINKED' }
          : {
              eip_product_id: null,
              link_id: null,
              status: 'NOT_CONNECTED',
              shared_snapshot: { updated_at: getNowIso() }
            }
      })
    );
  };

  const handleApplyIntegrationPatch = (patch, link) => {
    if (!styleContext?.id || !variantContext?.id) return;
    commitIntegrationData((current) =>
      applyEipSharedPatch(current, {
        styleId: styleContext.id,
        variantId: variantContext.id,
        patch,
        link: { ...link, eip_product_id: variantContext?.integration?.eip?.productId }
      })
    );
  };

  const handleCreateWorkspaceFromEip = (product, eipProductId) => {
    const starter = buildEipStarterInput(product);
    const projectNode = createProjectNode(starter.project, workspaceActor);
    const styleNode = createStyleNode(projectNode, starter.style);
    const variantNode = createVariantNode(styleNode, starter.variant);
    const linkedVariant = {
      ...variantNode,
      integration: {
        ...(variantNode.integration || {}),
        eip: { productId: eipProductId, status: 'PENDING_LINK' }
      }
    };
    const linkedStyle = { ...styleNode, children: [linkedVariant] };
    const linkedProject = { ...projectNode, children: [linkedStyle] };
    commitIntegrationData((current) => ({
      ...current,
      projects: [...(current.projects || []), linkedProject]
    }));
    setSelectedNodeId(linkedVariant.id);
    setExpandedNodes((current) => new Set([...current, linkedProject.id, linkedStyle.id, linkedVariant.id]));
    return { project: linkedProject, style: linkedStyle, variant: linkedVariant };
  };

  const openCreateProject = () => {
    setOpenMenuNodeId(null);
    setEntityModal({
      mode: 'create',
      nodeType: 'project',
      label: 'Project',
      parentId: null,
      values: createProjectNode({}, workspaceActor).values
    });
  };

  const handleTreeAction = (action, node) => {
    setOpenMenuNodeId(null);

    if (action === 'edit') {
      setEntityModal({
        mode: 'edit',
        nodeType: node.nodeType,
        label: t(metadata.structure?.treeTypes?.[node.nodeType]?.labelKey),
        nodeId: node.id,
        values: node.values || {}
      });
      return;
    }

    if (action === 'delete') {
      setDeleteModal({ node });
      return;
    }

    if (action === 'create-style') {
      setEntityModal({
        mode: 'create',
        nodeType: 'product',
        label: pfUiT('ui.workspace.entity.style', {}, 'Style'),
        parentId: node.id,
        values: createStyleNode(node).values
      });
      return;
    }

    if (action === 'create-variant') {
      setEntityModal({
        mode: 'create',
        nodeType: 'variant',
        label: pfUiT('ui.workspace.entity.variant', {}, 'Variant'),
        parentId: node.id,
        values: createVariantNode(node).values
      });
    }
  };

  const handleSubmitEntity = (values) => {
    if (!entityModal) return;

    markDirty();

    if (entityModal.mode === 'edit') {
      setWorkspaceData((current) => ({
        ...current,
        projects: updateNodeById(
          current.projects || [],
          entityModal.nodeId,
          (node) => ({
            ...node,
            values: {
              ...(node.values || {}),
              ...values
            }
          })
        )
      }));
      setEntityModal(null);
      return;
    }

    setWorkspaceData((current) => {
      let nextNode;

      if (entityModal.nodeType === 'project') {
        nextNode = createProjectNode(values, workspaceActor);
        setSelectedNodeId(nextNode.id);
        setExpandedNodes((expanded) => new Set([...expanded, nextNode.id]));
        return {
          ...current,
          projects: [
            ...(current.projects || []),
            nextNode
          ]
        };
      }

      const parent = findNodeById(current.projects || [], entityModal.parentId);

      if (entityModal.nodeType === 'product') {
        nextNode = createStyleNode(parent, values);
      } else {
        nextNode = createVariantNode(parent, values);
      }

      setSelectedNodeId(nextNode.id);
      setExpandedNodes((expanded) => new Set([...expanded, entityModal.parentId, nextNode.id]));

      return {
        ...current,
        projects: insertChildNode(current.projects || [], entityModal.parentId, nextNode)
      };
    });

    setEntityModal(null);
  };

  const handleConfirmDelete = () => {
    if (!deleteModal?.node) return;

    const nodeId = deleteModal.node.id;
    markDirty();

    setWorkspaceData((current) => {
      const nextProjects = removeNodeById(current.projects || [], nodeId);
      const stillSelected = findNodeById(nextProjects, selectedNodeId);

      if (!stillSelected || selectedNodeId === nodeId) {
        setSelectedNodeId(findFirstSelectable(nextProjects));
      }

      setExpandedNodes((expanded) => {
        const next = new Set(expanded);
        next.delete(nodeId);
        return next;
      });

      return {
        ...current,
        projects: nextProjects
      };
    });

    setDeleteModal(null);
  };

  const displayContext =
    variantContext ||
    styleContext ||
    selectedNode;

  const baseReferenceLabel =
    variantContext
      ? getDropdownLabel(
          metadata,
          'BASE_REFERENCE_SIZE',
          variantContext
            .values?.[
            'variant.base_reference_size'
          ],
          t
        )
      : '';

  const sizeSystemLabel =
    variantContext
      ? getDropdownLabel(
          metadata,
          'SIZE_SYSTEM',
          variantContext
            .values?.[
            'variant.size_system'
          ],
          t
        )
      : '';


  const approvalItems =
    buildWorkspaceApprovalItems({
      metadata,
      project: projectContext,
      variant: variantContext,
      t
    });

  const technicalReleaseComplete =
    isTechnicalReleaseComplete(
      approvalItems
    );

  const publicationApprovalItem =
    approvalItems.find(
      (item) =>
        item.workflowKey ===
        'CATALOGUE_RELEASE'
    ) ||
    null;

  const buildModeratorMessageContext = (
    item = publicationApprovalItem
  ) => {
    if (
      !variantContext ||
      !item?.requestId
    ) {
      return null;
    }

    return {
      contextType:
        'PUBLICATION_RELEASE',
      contextLabel:
        'Publication review',
      requestId:
        item.requestId,
      variantId:
        variantContext.id,
      styleId:
        styleContext?.id ||
        null,
      projectId:
        projectContext?.id ||
        null,
      title:
        getNodeTitle(
          metadata,
          styleContext ||
            variantContext,
          t
        ),
      subtitle:
        variantContext.values?.[
          'variant.code'
        ] ||
        '',
      recipientRole:
        'MODERATOR',
      recipientLabel:
        metadata.approval?.workflows
          ?.CATALOGUE_RELEASE
          ?.moderatorRoleLabel ||
        'Moderator'
    };
  };

  const handleMessageModerator = (
    item
  ) => {
    const context =
      buildModeratorMessageContext(
        item
      );

    if (!context) {
      return;
    }

    setMessagingOpenRequest(
      context
    );
  };

  const handleApprovalTransition = (
    item,
    transition
  ) => {
    if (
      !item?.target ||
      !transition?.to
    ) {
      return;
    }

    if (isDirty) {
      window.showToast?.(
        'Save Workspace changes before changing approval or release status.',
        'warning'
      );
      return;
    }

    const target =
      item.target;

    const requestId =
      target.kind ===
        'PUBLICATION_RELEASE'
        ? item.requestId ||
          createPublicationRequestId(
            metadata
          )
        : null;

    setWorkspaceData(
      (current) => {
        const nextData = {
          ...current,
          projects:
            updateNodeById(
              current.projects ||
                [],
              target.nodeId,
              (node) => {
                if (
                  target.kind ===
                  'NODE_FIELD'
                ) {
                  const nextRecord =
                    applyApprovalTransitionToRecord({
                      record:
                        node.values ||
                        {},
                      statusKey:
                        target.fieldKey,
                      transition,
                      actor:
                        workspaceActor
                    });

                  return {
                    ...node,
                    values:
                      nextRecord
                  };
                }

                if (
                  target.kind ===
                  'MEASUREMENT_CHART'
                ) {
                  const sourceRecord =
                    transition.code === 'APPROVE' &&
                    node.values?.workflow?.hasUnreleasedChanges
                      ? createMeasurementChartRevision(
                          node.values || {},
                          {
                            revisionReason:
                              node.values?.workflow?.pendingRevisionReason ||
                              'Approved Measurement Chart baseline',
                            workflow: {
                              ...(node.values?.workflow || {}),
                              hasUnreleasedChanges: false,
                              pendingRevisionReason: ''
                            }
                          }
                        )
                      : node.values || {};
                  const nextRecord =
                    applyApprovalTransitionToRecord({
                      record:
                        sourceRecord,
                      statusKey:
                        target.statusKey || 'status',
                      transition,
                      actor:
                        workspaceActor
                    });

                  if (
                    transition.code ===
                    'APPROVE'
                  ) {
                    const approvedAt =
                      getNowIso();

                    nextRecord.revisionHistory =
                      (nextRecord.revisionHistory || []).map(
                        (revision) =>
                          revision.status === 'APPROVED'
                            ? {
                                ...revision,
                                status: 'SUPERSEDED',
                                supersededAt: approvedAt,
                                supersededByRevisionNumber:
                                  nextRecord.revisionNumber,
                                supersededByRevisionLabel:
                                  nextRecord.revisionLabel
                              }
                            : revision
                      );

                    nextRecord.approvedRevisionNumber =
                      nextRecord.revisionNumber;
                    nextRecord.approvedRevisionLabel =
                      nextRecord.revisionLabel;
                    nextRecord.workflow = {
                      ...(nextRecord.workflow || {}),
                      hasUnreleasedChanges: false,
                      pendingRevisionReason: ''
                    };
                  }

                  return {
                    ...node,
                    values:
                      nextRecord
                  };
                }

                if (
                  target.kind ===
                  'ARRAY_ITEM'
                ) {
                  const collection =
                    Array.isArray(
                      node.values?.[
                        target.collectionKey
                      ]
                    )
                      ? node.values[
                          target.collectionKey
                        ]
                      : [];

                  return {
                    ...node,
                    values: {
                      ...(node.values ||
                        {}),
                      [target.collectionKey]:
                        collection.map(
                          (record) =>
                            record.id ===
                            target.itemId
                              ? applyApprovalTransitionToRecord({
                                  record,
                                  statusKey:
                                    target.statusKey,
                                  transition,
                                  actor:
                                    workspaceActor
                                })
                              : record
                        )
                    }
                  };
                }

                if (
                  target.kind ===
                  'PUBLICATION_RELEASE'
                ) {
                  const currentPublication = {
                    ...(node.values
                      ?.publicationRelease ||
                      {}),
                    status:
                      item.status
                  };

                  const nextPublication =
                    applyApprovalTransitionToRecord({
                      record:
                        currentPublication,
                      statusKey:
                        'status',
                      transition,
                      actor:
                        workspaceActor
                    });

                  if (
                    transition.code ===
                      'REQUEST_MODERATOR_RELEASE' ||
                    transition.code ===
                      'RESUBMIT_MODERATOR_RELEASE'
                  ) {
                    nextPublication.requestId =
                      requestId;

                    nextPublication.requestedAt =
                      getNowIso();

                    nextPublication.requestedBy = {
                      id:
                        workspaceActor.id,
                      name:
                        workspaceActor.name,
                      login:
                        workspaceActor.login
                    };

                    nextPublication.moderatorNote =
                      '';

                    nextPublication.submittedFitSpecification =
                      buildWorkspaceFitSpecificationSnapshot({
                        project: projectContext,
                        style: styleContext,
                        variant: node,
                        metadata,
                        requestId,
                        createdAt: nextPublication.requestedAt
                      });
                  }

                  return {
                    ...node,
                    values: {
                      ...(node.values ||
                        {}),
                      publicationRelease:
                        nextPublication
                    }
                  };
                }

                return node;
              }
            )
        };

        persistWorkspaceData(
          nextData
        );

        savedBaselineRef.current =
          cloneValue(
            nextData
          );

        return nextData;
      }
    );

    setIsDirty(false);
    setSaveState(
      'saved'
    );

    window.showToast?.(
      `${item.title}: ${transition.label}`,
      transition.intent ===
        'release'
        ? 'success'
        : 'info'
    );
  };

  const kicker =
    t('workspace.kicker');

  const title =
    t('workspace.title');

  const subtitle =
    t('workspace.subtitle');

  const visibleProjects = useMemo(() => {
    const query = treeSearch.trim().toLowerCase();

    if (!query) {
      return workspaceData.projects || [];
    }

    const matches = (node) =>
      getNodeTitle(metadata, node, t).toLowerCase().includes(query);

    const filterNodes = (nodes = []) =>
      nodes
        .map((node) => {
          const children = filterNodes(node.children || []);

          if (matches(node) || children.length) {
            return {
              ...node,
              children
            };
          }

          return null;
        })
        .filter(Boolean);

    return filterNodes(workspaceData.projects || []);
  }, [workspaceData.projects, treeSearch, metadata, activeLocale]);

  return (
    <section
      id="perfect-fit-workspace"
      data-workspace-version={
        metadata.version
      }
      data-workspace-locale={
        activeLocale
      }
      className="min-h-[100dvh] bg-[#F7F6F2] p-0 sm:px-2 sm:pb-2 sm:pt-0"
    >
      <div className="mx-auto min-h-[100dvh] w-full overflow-hidden bg-[#FCFBF8] sm:min-h-0 sm:rounded-[14px] sm:border sm:border-[#D9D5CC]">
        <div
          className={`relative grid min-h-[100dvh] grid-cols-1 xl:min-h-[700px] ${
            desktopTreeCollapsed
              ? 'xl:grid-cols-[72px_minmax(0,1fr)]'
              : 'xl:grid-cols-[245px_minmax(0,1fr)]'
          }`}
        >
          {mobileTreeOpen && (
            <button
              type="button"
              aria-label={pfUiT("ui.components.workspace.297fc80da3")}
              onClick={() => setMobileTreeOpen(false)}
              className="fixed inset-0 z-40 bg-[#272622]/30 xl:hidden"
            />
          )}

          <aside
            className={`fixed inset-y-0 left-0 z-50 w-[86vw] max-w-[320px] border-r border-[#D9D5CC] bg-[#FCFBF8] shadow-[18px_0_50px_rgba(39,38,34,0.16)] transition-transform duration-200 xl:static xl:z-auto xl:w-auto xl:max-w-none xl:translate-x-0 xl:border-b-0 xl:border-r xl:shadow-none ${
              mobileTreeOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div
              className={`border-b border-[#E5E2DA] px-3.5 py-3 ${
                desktopTreeCollapsed ? 'xl:px-2.5' : ''
              }`}
            >
              <div
                className={`flex items-center gap-2 ${
                  desktopTreeCollapsed ? 'xl:justify-center' : ''
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-[#E5E2DA] bg-white text-[#7B5C49]">
                  <FolderTree className="h-4 w-4" />
                </div>

                <div
                  className={`min-w-0 flex-1 ${
                    desktopTreeCollapsed ? 'xl:hidden' : ''
                  }`}
                >
                  <div className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-[#918D84]">
                    {kicker || 'Design Sandbox'}
                  </div>
                  <div className="truncate text-[14px] font-semibold text-[#272622]">
                    {title || 'Workspace'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileTreeOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#6F6C65] hover:bg-[#F4F2ED] xl:hidden"
                  aria-label={pfUiT("ui.components.workspace.297fc80da3")}
                >
                  <X className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setDesktopTreeCollapsed((current) => !current)
                  }
                  className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-[#E5E2DA] bg-white text-[#6F6C65] transition hover:border-[#CDB9A8] hover:bg-[#F8F4EE] hover:text-[#7B5C49] xl:flex"
                  aria-label={
                    desktopTreeCollapsed
                      ? 'Expand workspace navigation'
                      : 'Collapse workspace navigation'
                  }
                  title={
                    desktopTreeCollapsed
                      ? 'Expand workspace navigation'
                      : 'Collapse workspace navigation'
                  }
                >
                  {desktopTreeCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div
                className={`mt-3 flex items-center gap-2 ${
                  desktopTreeCollapsed ? 'xl:hidden' : ''
                }`}
              >
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#918D84]" />
                  <input
                    value={treeSearch}
                    onChange={(event) => setTreeSearch(event.target.value)}
                    placeholder={pfUiT("ui.components.workspace.d58a63c746")}
                    className="h-8 w-full rounded-[9px] border border-[#E5E2DA] bg-[#F8F7F3] pl-8 pr-2 text-[12px] text-[#272622] placeholder:text-[#918D84] focus:border-[#BCA892] focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={openCreateProject}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-[#D9D5CC] bg-[#272622] text-white hover:bg-[#3A3934]"
                  aria-label={pfUiT("ui.components.workspace.b977aed1af")}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              className={`h-[calc(100dvh-118px)] space-y-1 overflow-y-auto p-2.5 xl:h-auto xl:max-h-[calc(100vh-170px)] ${
                desktopTreeCollapsed ? 'xl:hidden' : ''
              }`}
            >
              {visibleProjects.length > 0 ? (
                visibleProjects.map((project) => (
                  <TreeNode
                    key={project.id}
                    metadata={metadata}
                    node={project}
                    depth={0}
                    selectedNodeId={selectedNodeId}
                    expandedNodes={expandedNodes}
                    openMenuNodeId={openMenuNodeId}
                    onSelect={handleSelectNode}
                    onToggle={handleToggleNode}
                    onOpenMenu={setOpenMenuNodeId}
                    onAction={handleTreeAction}
                    t={t}
                  />
                ))
              ) : (
                <div className="rounded-[10px] border border-dashed border-[#D9D5CC] bg-[#F8F7F3] px-3 py-4 text-[12px] leading-relaxed text-[#6F6C65]">{pfUiT("ui.components.workspace.16b69c9287")}</div>
              )}
            </div>
          </aside>

          <main className="min-w-0 overflow-hidden bg-[#F8F7F3] xl:min-h-[700px]">
          {selectedNode && (
            <>
              <div className="border-b border-[#E5E2DA] bg-[#FCFBF8] px-3 py-2.5 xl:px-5 xl:py-4">
                <div className="flex items-start justify-between gap-2 xl:items-center">
                  <div className="flex min-w-0 gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setMobileTreeOpen(true)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[#D9D5CC] bg-white text-[#6F5A42] xl:hidden"
                      aria-label={pfUiT("ui.components.workspace.7415277e60")}
                    >
                      <FolderTree className="h-4 w-4" />
                    </button>
                    <div className="hidden h-[86px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[#E5E2DA] bg-[#F4F2ED] text-[#918D84] sm:flex">
                      {headerPrimaryMediaSource ? (
                        <img
                          src={headerPrimaryMediaSource}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-6 w-6" />
                      )}
                    </div>
                    <div className="min-w-0">
                    {selectedPath.length >
                      1 && (
                      <div className="mb-1.5 hidden flex-wrap items-center gap-1.5 text-[10px] text-[#918D84] xl:flex">
                        {selectedPath.map(
                          (
                            node,
                            index
                          ) => (
                            <React.Fragment
                              key={
                                node.id
                              }
                            >
                              {index >
                                0 && (
                                <ChevronRight className="h-3 w-3" />
                              )}

                              <span className="truncate">
                                {getNodeTitle(
                                  metadata,
                                  node,
                                  t
                                )}
                              </span>
                            </React.Fragment>
                          )
                        )}
                      </div>
                    )}

                    <h2 className="truncate text-[18px] font-semibold leading-tight text-[#272622] sm:text-[20px] xl:text-[26px]">
                      {getNodeTitle(
                        metadata,
                        displayContext,
                        t
                      )}
                    </h2>

                    {styleContext &&
                      variantContext && (
                        <p className="mt-1 text-[13px] text-[#6F6C65]">
                          {getNodeTitle(
                            metadata,
                            styleContext,
                            t
                          )}
                        </p>
                      )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {styleContext?.values?.['product.style_code'] && (
                        <span className="hidden rounded-full border border-[#D9D5CC] bg-[#F4F2ED] px-2.5 py-1 text-[11px] text-[#6F6C65] sm:inline-flex">
                          {styleContext.values['product.style_code']}
                        </span>
                      )}
                      {variantContext?.values?.['variant.code'] && (
                        <span className="rounded-full border border-[#D9D5CC] bg-[#F4F2ED] px-2 py-0.5 text-[9px] text-[#6F6C65] sm:px-2.5 sm:py-1 sm:text-[11px]">
                          {variantContext.values['variant.code']}
                        </span>
                      )}
                    </div>
                    </div>

                    {variantContext && (
                      <ProductIntegrationMenu
                        project={projectContext}
                        style={styleContext}
                        variant={variantContext}
                        onApplySharedPatch={handleApplyIntegrationPatch}
                        onCreateFromEip={handleCreateWorkspaceFromEip}
                        onIntegrationChange={handleIntegrationChange}
                      />
                    )}

                    {variantContext && (
                      <div className="ml-auto flex shrink-0 items-center gap-1 xl:hidden">
                        {isProjectOwner && (
                          <button
                            type="button"
                            onClick={() => setShareOpen(true)}
                            disabled={isDirty}
                            className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#D9D5CC] bg-white text-[#6F6C65] disabled:opacity-35"
                            aria-label={pfUiT("ui.components.workspace.0f8423a29f")}
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleSaveWorkspace}
                          disabled={!isDirty || isSaving}
                          className={`flex h-9 w-9 items-center justify-center rounded-[9px] border ${
                            isDirty
                              ? 'border-[#272622] bg-[#272622] text-white'
                              : 'border-[#D9D5CC] bg-[#F4F2ED] text-[#918D84]'
                          }`}
                          aria-label={pfUiT("ui.components.workspace.4a2376f4a7")}
                        >
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : saveState === 'saved' && !isDirty ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {variantContext && (
                    <div className="hidden min-w-0 items-center gap-3 xl:flex xl:justify-end">
                      <WorkspaceApprovalCenter
                        metadata={metadata}
                        items={approvalItems}
                        onTransition={handleApprovalTransition}
                        onMessageModerator={handleMessageModerator}
                        disabled={isDirty}
                        disabledReason="Save Workspace changes before changing approval or release status."
                      />

                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        {sizeSystemLabel && (
                          <span className="rounded-full border border-[#D9D5CC] bg-[#F4F2ED] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6F6C65]">
                            {
                              sizeSystemLabel
                            }
                          </span>
                        )}

                        {baseReferenceLabel && (
                          <span className="rounded-full border border-[#D9D5CC] bg-[#F4F2ED] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6F6C65]">
                            {
                              t(
                                'fields.variant.baseReferenceSize.label'
                              )
                            }
                            {' · '}
                            {
                              baseReferenceLabel
                            }
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {!variantContext && (
                    <div className="flex items-center gap-2">
                      {isProjectOwner && (
                        <button
                          type="button"
                          onClick={() => setShareOpen(true)}
                          disabled={isDirty}
                          title={isDirty ? 'Save Workspace changes before changing collaboration access.' : 'Share this designer-owned work'}
                          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[9px] border border-[#D9D5CC] bg-white px-2.5 text-[11px] font-semibold text-[#4A4741] hover:bg-[#EFEEE8] disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:text-[12px]"
                        >
                          <Share2 className="h-3.5 w-3.5" />{pfUiT("ui.components.workspace.58db2b6a0b")}</button>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveWorkspace}
                      disabled={!isDirty || isSaving}
                      className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[9px] border px-3 text-[12px] font-semibold transition-colors ${
                        isDirty
                          ? 'border-[#272622] bg-[#272622] text-white hover:bg-[#3A3934]'
                          : 'border-[#D9D5CC] bg-[#F4F2ED] text-[#918D84]'
                      } ${isSaving ? 'cursor-wait opacity-80' : ''}`}
                    >
                      {isSaving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : saveState === 'saved' ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      {isSaving ? 'Saving' : saveState === 'saved' && !isDirty ? 'Saved' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {variantContext && (
                <ModuleNavigation
                  metadata={
                    metadata
                  }
                  variantNode={
                    variantContext
                  }
                  selectedNodeId={
                    selectedNodeId
                  }
                  onSelect={
                    handleSelectNode
                  }
                  onSave={
                    handleSaveWorkspace
                  }
                  onShare={() =>
                    setShareOpen(true)
                  }
                  canShare={
                    isProjectOwner
                  }
                  surfaceVisibility={surfaceVisibility}
                  isDirty={
                    isDirty
                  }
                  isSaving={
                    isSaving
                  }
                  saveState={
                    saveState
                  }
                  t={t}
                />
              )}

              <div className="min-h-0 bg-[#F8F7F3] p-2 pb-20 sm:p-3 sm:pb-20 xl:pb-3">
                {selectedSurfaceHidden ? (
                  <div className="flex min-h-[420px] items-center justify-center rounded-[14px] border border-dashed border-[#D9D5CC] bg-[#FCFBF8] px-6 py-8 text-center text-[13px] text-[#6F6C65]">
                    <div>
                      <Layers3 className="mx-auto h-8 w-8 text-[#918D84]" />
                      <p className="mt-3 font-semibold text-[#4A4741]">{pfUiT("ui.components.workspace.ec15a3ff67")}</p>
                      <p className="mt-1 text-[11px] text-[#918D84]">{pfUiT("ui.components.workspace.38f38214f4")}</p>
                    </div>
                  </div>
                ) : ModuleComponent ? (
                  <ModuleComponent
                    node={
                      selectedNode
                    }
                    variant={
                      variantContext
                    }
                    style={
                      styleContext
                    }
                    project={
                      projectContext
                    }
                    values={
                      selectedNode.values ||
                      {}
                    }
                    currentUser={
                      currentUser
                    }
                    workspaceData={
                      workspaceData
                    }
                    metadata={
                      metadata
                    }
                    locale={
                      activeLocale
                    }
                    t={t}
                    onChange={
                      handleFieldChange
                    }
                    onNavigateModule={(nodeType) => {
                      const targetNode =
                        variantContext?.children?.find(
                          (child) =>
                            child.nodeType === nodeType &&
                            isWorkspaceNodeVisible(surfaceVisibility, child.nodeType)
                        );

                      if (targetNode) {
                        handleSelectNode(targetNode.id);
                      }
                    }}
                    onOpenCompanion={openWorkspaceCompanion}
                  />
                ) : selectedNode.nodeType === 'variant' ? (
                  <OverviewModule
                    metadata={metadata}
                    node={selectedNode}
                    variant={variantContext}
                    style={styleContext}
                    project={projectContext}
                    onChange={handleFieldChange}
                    t={t}
                  />
                ) : getFieldGroups(
                    metadata,
                    selectedNode.nodeType
                  ).length ? (
                  <MetadataForm
                    metadata={
                      metadata
                    }
                    node={
                      selectedNode
                    }
                    onFieldChange={
                      handleFieldChange
                    }
                    t={t}
                  />
                ) : (
                  <EmptyModule
                    metadata={
                      metadata
                    }
                    node={
                      selectedNode
                    }
                    t={t}
                  />
                )}
              </div>

              {variantContext && (
                <MobileModuleNavigation
                  metadata={metadata}
                  variantNode={variantContext}
                  selectedNodeId={selectedNodeId}
                  onSelect={handleSelectNode}
                  surfaceVisibility={surfaceVisibility}
                  t={t}
                />
              )}
            </>
          )}
          {!selectedNode && (
            <div className="flex min-h-[520px] items-center justify-center p-6">
              <div className="rounded-[12px] border border-dashed border-[#D9D5CC] bg-[#FCFBF8] px-6 py-8 text-center text-[13px] text-[#6F6C65]">
                <FolderTree className="mx-auto h-8 w-8 text-[#918D84]" />
                <p className="mt-3">{pfUiT("ui.components.workspace.713a241548")}</p>
              </div>
            </div>
          )}
        </main>
      </div>
      </div>

      <WorkspaceCompanionLayer
        metadata={metadata}
        panels={companionPanels}
        variant={variantContext}
        style={styleContext}
        project={projectContext}
        currentUser={currentUser}
        onChange={handleFieldChange}
        onPatchPanel={patchCompanionPanel}
        onBringFront={bringCompanionFront}
        onMinimizePanel={minimizeWorkspaceCompanion}
        onRestorePanel={restoreWorkspaceCompanion}
        onClosePanel={closeWorkspaceCompanion}
        onNavigateModule={(nodeType) => {
          const targetNode = variantContext?.children?.find(
            (child) =>
              child.nodeType === nodeType &&
              isWorkspaceNodeVisible(surfaceVisibility, child.nodeType)
          );

          if (targetNode) {
            handleSelectNode(targetNode.id);
          }
        }}
        t={t}
      />

      <WorkspaceMessagingWidget
        storageKey={`${storageKey}_messages_v1`}
        currentUser={currentUser}
        context={buildModeratorMessageContext(publicationApprovalItem)}
        openRequest={messagingOpenRequest}
        onOpenRequestHandled={() =>
          setMessagingOpenRequest(null)
        }
        showLauncher={false}
      />

      <CollaborationShareModal
        open={shareOpen}
        metadata={metadata}
        currentUser={currentUser}
        selectedPath={selectedPath}
        grants={workspaceData.collaboration?.grants || []}
        onClose={() => setShareOpen(false)}
        onCreateGrant={handleCreateCollaborationGrant}
        onRevokeGrant={handleRevokeCollaborationGrant}
        t={t}
      />

      <EntityModal
        metadata={metadata}
        state={entityModal}
        onClose={() => setEntityModal(null)}
        onSubmit={handleSubmitEntity}
        t={t}
      />

      <ConfirmDeleteModal
        state={deleteModal}
        onClose={() => setDeleteModal(null)}
        onConfirm={handleConfirmDelete}
        metadata={metadata}
        t={t}
      />
    </section>
  );
}
