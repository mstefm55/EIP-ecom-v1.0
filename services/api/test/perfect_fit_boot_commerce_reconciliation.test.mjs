import assert from "node:assert/strict";
import test from "node:test";
import { reconcilePerfectFitCommerceAtBoot } from "../src/services/perfectFit/bootCommerceReconciliation.js";

function makeApp({ rows = [], tenantDiscoveryError = null } = {}) {
  const info = [];
  const errors = [];
  return {
    app: {
      db: {
        async query() {
          if (tenantDiscoveryError) throw tenantDiscoveryError;
          return { rows, rowCount: rows.length };
        }
      },
      log: {
        info(entry) {
          info.push(entry);
        },
        error(entry) {
          errors.push(entry);
        }
      }
    },
    info,
    errors
  };
}

test("PF boot commerce reconciliation checks every active tenant", async () => {
  const { app, info, errors } = makeApp({
    rows: [{ id: "tenant-a" }, { id: "tenant-b" }]
  });
  const calls = [];

  const summary = await reconcilePerfectFitCommerceAtBoot(app, {
    reconcileTenant: async (tenantId) => {
      calls.push(tenantId);
    }
  });

  assert.deepEqual(calls, ["tenant-a", "tenant-b"]);
  assert.deepEqual(summary, {
    ok: true,
    tenants: 2,
    checked: 2,
    failed: 0
  });
  assert.equal(errors.length, 0);
  assert.equal(info.at(-1)?.event, "perfect_fit_commerce_boot_reconcile");
});

test("PF boot commerce reconciliation isolates a tenant failure", async () => {
  const { app, info, errors } = makeApp({
    rows: [{ id: "tenant-a" }, { id: "tenant-b" }]
  });

  const summary = await reconcilePerfectFitCommerceAtBoot(app, {
    reconcileTenant: async (tenantId) => {
      if (tenantId === "tenant-b") throw new Error("synthetic failure");
    }
  });

  assert.deepEqual(summary, {
    ok: false,
    tenants: 2,
    checked: 1,
    failed: 1
  });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].event, "perfect_fit_commerce_boot_reconcile_tenant_failed");
  assert.equal(errors[0].tenant_id, "tenant-b");
  assert.equal(info.at(-1)?.event, "perfect_fit_commerce_boot_reconcile");
});

test("PF boot commerce reconciliation fails closed to a diagnostic when tenant discovery fails", async () => {
  const { app, info, errors } = makeApp({
    tenantDiscoveryError: new Error("db unavailable")
  });

  const summary = await reconcilePerfectFitCommerceAtBoot(app, {
    reconcileTenant: async () => {
      throw new Error("must not be called");
    }
  });

  assert.deepEqual(summary, {
    ok: false,
    tenants: 0,
    checked: 0,
    failed: 1
  });
  assert.equal(info.length, 0);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].event, "perfect_fit_commerce_boot_reconcile_failed");
  assert.equal(errors[0].stage, "tenant_discovery");
});
