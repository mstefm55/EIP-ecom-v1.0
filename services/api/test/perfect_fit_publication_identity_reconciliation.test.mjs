import test from "node:test";
import assert from "node:assert/strict";

import { reconcilePerfectFitPublicationByIdentity } from "../src/services/perfectFit/publicationIdentityReconciliation.js";

const TENANT_ID = "0a578107-93ee-495e-bd9e-287f127ec120";
const MATERIAL_ID = "dbc75295-6b06-4d21-bd2a-498ef2d802f2";

test("PF approval projects to EIP active while publication remains a separate governed gate", async () => {
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (calls.length === 1) {
        return { rowCount: 1, rows: [{ id: MATERIAL_ID, is_active: true }] };
      }
      return { rowCount: 1, rows: [{ id: MATERIAL_ID }] };
    }
  };

  const result = await reconcilePerfectFitPublicationByIdentity(db, TENANT_ID);

  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.deepEqual(call.params, [
      TENANT_ID,
      "PERFECT_FIT_PRODUCT",
      "PERFECT_FIT_PRODUCT_LINK",
      "PERFECT_FIT_PUBLICATION_REQUEST"
    ]);
    assert.match(call.sql, /DISTINCT ON \(cp\.material_id\)/);
    assert.match(call.sql, /publication_record\.payload->'identity'->>'variant_id'=cp\.variant_id/);
    assert.match(call.sql, /publication_record\.payload->'identity'->>'variant_code'=cp\.variant_code/);
    assert.match(call.sql, /publication_record\.updated_at DESC/);
  }

  const activationSql = calls[0].sql;
  assert.match(activationSql, /service_object_status, ''\)\) IN \('approved', 'published'\)/);
  assert.match(activationSql, /content_approved/);
  assert.match(activationSql, /content_published/);
  assert.match(activationSql, /THEN true/);
  assert.match(activationSql, /service_object_status, ''\)\) IN \('new', 'review', 'rejected', 'cancelled'\)/);
  assert.match(activationSql, /content_review/);
  assert.match(activationSql, /content_rejected/);
  assert.match(activationSql, /THEN false/);
  assert.match(activationSql, /SET is_active=aa\.should_be_active/);
  assert.match(activationSql, /m\.is_active IS DISTINCT FROM aa\.should_be_active/);

  const publicationSql = calls[1].sql;
  assert.match(publicationSql, /lower\(COALESCE\(lp\.service_object_status, ''\)\)='published'/);
  assert.match(publicationSql, /content_published/);
  assert.match(publicationSql, /publication_reconciled_source', 'PF_STABLE_IDENTITY'/);

  assert.deepEqual(result, {
    approval_activation_reconciled: 1,
    approval_materials: [{ id: MATERIAL_ID, is_active: true }],
    publication_identity_reconciled: 1,
    material_ids: [MATERIAL_ID]
  });
});

test("PF approval/publication reconciliation is a no-op when no authoritative state matches", async () => {
  const db = {
    async query() {
      return { rowCount: 0, rows: [] };
    }
  };

  const result = await reconcilePerfectFitPublicationByIdentity(db, TENANT_ID);
  assert.deepEqual(result, {
    approval_activation_reconciled: 0,
    approval_materials: [],
    publication_identity_reconciled: 0,
    material_ids: []
  });
});
