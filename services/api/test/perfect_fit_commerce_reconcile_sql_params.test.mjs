import assert from "node:assert/strict";
import test from "node:test";
import { reconcilePerfectFitCommerceProjections } from "../src/services/perfectFit/productGateway.js";

test("PF commerce reconciliation uses contiguous typed SQL parameters", async () => {
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql: String(sql), params: [...(params || [])] });
      return { rowCount: 0, rows: [] };
    }
  };

  const tenantId = "00000000-0000-4000-8000-000000000001";
  const materialId = "00000000-0000-4000-8000-000000000002";
  const result = await reconcilePerfectFitCommerceProjections(db, tenantId, materialId);

  assert.deepEqual(result, {
    digital_profile_reconciled: 0,
    publication_projection_reconciled: 0
  });
  assert.equal(calls.length, 2);

  const digital = calls[0];
  assert.equal(digital.params.length, 5);
  assert.deepEqual(digital.params, [
    tenantId,
    "PRODUCT",
    "PERFECT_FIT_PRODUCT",
    materialId,
    "digital"
  ]);
  assert.match(digital.sql, /\$1/);
  assert.match(digital.sql, /\$2/);
  assert.match(digital.sql, /\$3/);
  assert.match(digital.sql, /\$4::uuid/);
  assert.match(digital.sql, /\$5::text/);
  assert.doesNotMatch(digital.sql, /\$6/);

  const publication = calls[1];
  assert.equal(publication.params.length, 4);
  assert.deepEqual(publication.params, [
    tenantId,
    "PRODUCT",
    materialId,
    "PERFECT_FIT_PUBLICATION_REQUEST"
  ]);
  assert.match(publication.sql, /\$1/);
  assert.match(publication.sql, /\$2/);
  assert.match(publication.sql, /\$3::uuid/);
  assert.match(publication.sql, /\$4/);
  assert.doesNotMatch(publication.sql, /\$5/);
});

test("PF commerce reconciliation supports tenant-wide boot repair without a material id", async () => {
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql: String(sql), params: [...(params || [])] });
      return { rowCount: calls.length === 1 ? 2 : 1, rows: [] };
    }
  };

  const tenantId = "00000000-0000-4000-8000-000000000001";
  const result = await reconcilePerfectFitCommerceProjections(db, tenantId);

  assert.deepEqual(result, {
    digital_profile_reconciled: 2,
    publication_projection_reconciled: 1
  });
  assert.equal(calls[0].params[3], null);
  assert.equal(calls[1].params[2], null);
});
