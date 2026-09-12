import test from "node:test";
import assert from "node:assert/strict";

import { reconcilePerfectFitPublicationByIdentity } from "../src/services/perfectFit/publicationIdentityReconciliation.js";

const TENANT_ID = "0a578107-93ee-495e-bd9e-287f127ec120";
const MATERIAL_ID = "dbc75295-6b06-4d21-bd2a-498ef2d802f2";

test("legacy PF publication repair uses latest stable variant identity and governed process state", async () => {
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rowCount: 1, rows: [{ id: MATERIAL_ID }] };
    }
  };

  const result = await reconcilePerfectFitPublicationByIdentity(db, TENANT_ID);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, [
    TENANT_ID,
    "PERFECT_FIT_PRODUCT",
    "PERFECT_FIT_PRODUCT_LINK",
    "PERFECT_FIT_PUBLICATION_REQUEST"
  ]);

  const sql = calls[0].sql;
  assert.match(sql, /DISTINCT ON \(cp\.material_id\)/);
  assert.match(sql, /publication_record\.payload->'identity'->>'variant_id'=cp\.variant_id/);
  assert.match(sql, /publication_record\.payload->'identity'->>'variant_code'=cp\.variant_code/);
  assert.match(sql, /publication_record\.updated_at DESC/);
  assert.match(sql, /lower\(COALESCE\(lp\.service_object_status, ''\)\)='published'/);
  assert.match(sql, /pi\.ended_at IS NULL/);
  assert.match(sql, /pi\.status='active'/);
  assert.match(sql, /content_published/);
  assert.match(sql, /publication_reconciled_source', 'PF_STABLE_IDENTITY'/);

  assert.deepEqual(result, {
    publication_identity_reconciled: 1,
    material_ids: [MATERIAL_ID]
  });
});

test("legacy PF publication repair is a no-op when no authoritative published identity matches", async () => {
  const db = {
    async query() {
      return { rowCount: 0, rows: [] };
    }
  };

  const result = await reconcilePerfectFitPublicationByIdentity(db, TENANT_ID);
  assert.deepEqual(result, {
    publication_identity_reconciled: 0,
    material_ids: []
  });
});
