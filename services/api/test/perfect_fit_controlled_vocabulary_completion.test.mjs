import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  normalizePerfectFitOrderLine,
  normalizePerfectFitOrderPayload
} from '../../../apps/samara-web/my-vite-react-app/src/services/perfectFitCheckoutIdentity.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const migration = read('services/api/db/migrations/0150_perfect_fit_controlled_vocabulary_completion.sql');
const manifestService = read('services/api/src/services/perfectFit/metadataManifest.js');
const runtimeMetadata = read('apps/samara-web/my-vite-react-app/src/lib/perfectFitRuntimeMetadata.js');
const checkoutService = read('apps/samara-web/my-vite-react-app/src/services/perfectFitCheckout.js');
const mannequinGuide = read('apps/samara-web/my-vite-react-app/src/components/MannequinGuide.jsx');

const governedLists = [
  'PF_MEDIA_ASSET_TYPE',
  'PF_MEDIA_ASSET_ROLE',
  'PF_MEDIA_PROFILE',
  'PF_TIME_STUDY_MODE',
  'PF_TIME_SEQUENCE_MODE',
  'PF_TIME_RECORDING_MODE',
  'PF_TIME_ANNOTATION_TYPE',
  'PF_COLLAB_SCOPE',
  'PF_COLLAB_DURATION',
  'PF_COLLAB_POLICY',
  'PF_COLLAB_ROLE',
  'PF_COLLAB_PERMISSION',
  'PF_MATERIAL_UOM',
  'PF_MATERIAL_CURRENCY',
  'PF_MATERIAL_INCOMING_STATUS',
  'PF_MATERIAL_ISSUE_TYPE',
  'PF_MESSAGE_TYPE',
  'PF_AVATAR_GENDER',
  'PF_AVATAR_AGE_GROUP',
  'PF_MEASUREMENT_UNIT',
  'PF_TECHPACK_SEQUENCE_MODE',
  'PF_TECHPACK_REFERENCE_TYPE'
];

const runtimeMappings = [
  ['MEDIA_ASSET_TYPE', "workspace.media, 'assetTypes'"],
  ['MEDIA_ASSET_ROLE', "workspace.media, 'assetRoles'"],
  ['MEDIA_PROFILE', "workspace.media, 'profiles'"],
  ['TIME_STUDY_MODE', "workspace.sewing.timeMotion, 'studyModes'"],
  ['TIME_SEQUENCE_MODE', "workspace.sewing.timeMotion, 'sequenceModes'"],
  ['TIME_RECORDING_MODE', "workspace.sewing.timeMotion, 'recordingModes'"],
  ['TIME_ANNOTATION_TYPE', "workspace.sewing.timeMotion, 'annotationTypes'"],
  ['COLLAB_SCOPE', "workspace.collaboration, 'shareScopes'"],
  ['COLLAB_DURATION', "workspace.collaboration, 'durations'"],
  ['COLLAB_POLICY', "workspace.collaboration, 'policies'"],
  ['COLLAB_ROLE', "workspace.collaboration, 'roles'"],
  ['COLLAB_PERMISSION', "workspace.collaboration, 'permissions'"],
  ['MATERIAL_UOM', "perfectFitMetadata.materials, 'uoms'"],
  ['MATERIAL_CURRENCY', "perfectFitMetadata.materials, 'currencies'"],
  ['MATERIAL_INCOMING_STATUS', "perfectFitMetadata.materials, 'incomingStatuses'"],
  ['MATERIAL_ISSUE_TYPE', "perfectFitMetadata.materials.stockIssue, 'transactionTypes'"],
  ['MESSAGE_TYPE', "perfectFitMetadata.messaging, 'messageTypes'"],
  ['AVATAR_GENDER', "perfectFitMetadata.measurement, 'avatarGenders'"],
  ['AVATAR_AGE_GROUP', "perfectFitMetadata.measurement, 'avatarAgeGroups'"],
  ['MEASUREMENT_UNIT', "perfectFitMetadata.measurement, 'units'"],
  ['TECHPACK_SEQUENCE_MODE', "perfectFitMetadata.techPack.drawingStudio, 'sequenceModes'"],
  ['TECHPACK_REFERENCE_TYPE', "perfectFitMetadata.techPack.drawingStudio, 'referenceTypes'"]
];

test('0150 completes PF controlled vocabularies additively in existing governance tables', () => {
  assert.match(migration, /0150_perfect_fit_controlled_vocabulary_completion/);
  assert.match(migration, /eip_core\.dropdown_list/);
  assert.match(migration, /eip_core\.dropdown_value/);
  assert.doesNotMatch(migration, /CREATE TABLE\s+/i);
  for (const list of governedLists) assert.match(migration, new RegExp(list));
  assert.match(migration, /PF_SIZE_SYSTEM/);
  assert.match(migration, /\('FR','FR',50\)/);
  assert.match(migration, /\('RU','RU',60\)/);
  assert.match(migration, /controlledBindings/);
  assert.match(migration, /2026-09-10-db-workspace-v5-controlled-governance/);
});

test('metadata API resolves controlled vocabularies from EIP dropdown authority', () => {
  assert.match(manifestService, /controlledBindings/);
  assert.match(manifestService, /controlledVocabularies/);
  assert.match(manifestService, /CONTROLLED_VOCABULARY/);
  assert.match(manifestService, /loadEffectiveDropdowns\(db, tenantId, allBindings\)/);
  assert.match(manifestService, /source:\s*"eip_core\.dropdown_list"/);
});

test('PF runtime consumes each declared controlled vocabulary instead of recreating list membership', () => {
  assert.match(runtimeMetadata, /applyControlledVocabularies/);
  assert.match(runtimeMetadata, /requireControlledVocabulary/);
  assert.match(runtimeMetadata, /has no governed values/);
  assert.match(runtimeMetadata, /replaceArrayContents/);
  for (const [logicalCode, targetSnippet] of runtimeMappings) {
    assert.match(runtimeMetadata, new RegExp(logicalCode));
    assert.ok(runtimeMetadata.includes(targetSnippet), `${logicalCode} must hydrate ${targetSnippet}`);
  }
});

test('Find My Size unit selectors consume the EIP-governed measurement unit vocabulary', () => {
  assert.match(migration, /\('MEASUREMENT_UNIT','cm','Centimetres'/);
  assert.match(migration, /\('MEASUREMENT_UNIT','in','Inches'/);
  assert.match(runtimeMetadata, /perfectFitMetadata\.measurement, 'units'/);
  assert.match(mannequinGuide, /perfectFitMetadata\.measurement\?\.units/);
  assert.match(mannequinGuide, /const measurementUnits = getMeasurementUnitOptions\(\)/);
  assert.match(mannequinGuide, /measurementUnits\.map\(\(option\) =>/);
  assert.doesNotMatch(mannequinGuide, /\['cm',\s*'in'\]\.map/);
  assert.match(mannequinGuide, /Legacy bootstrap keeps the UI usable before EIP metadata hydration/);
});

test('checkout preserves canonical EIP material identity', () => {
  const uuid = '5f99eb8d-a68f-4a39-8a64-3c4ad06ff829';
  assert.deepEqual(
    normalizePerfectFitOrderLine({ material_code: uuid, quantity: 2 }),
    { material_id: uuid, quantity: 2 }
  );
  assert.deepEqual(
    normalizePerfectFitOrderLine({ material_code: 'PRD-ABC123', quantity: 1 }),
    { material_code: 'PRD-ABC123', quantity: 1 }
  );
  assert.deepEqual(
    normalizePerfectFitOrderPayload({ line_items: [{ material_id: uuid, quantity: 3 }] }).line_items,
    [{ material_id: uuid, quantity: 3 }]
  );
  assert.match(checkoutService, /normalizePerfectFitOrderPayload/);
  assert.match(checkoutService, /body:\s*normalizePerfectFitOrderPayload\(payload\)/);
});
