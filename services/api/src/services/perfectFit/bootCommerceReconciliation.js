import { listPerfectFitProducts } from "./productGateway.js";

/**
 * Repair legacy Perfect Fit commerce projections once when the public-commerce
 * surface boots. Round-1 publication writes now persist the canonical material
 * workflow stage for future changes; this boot pass only brings older PF-linked
 * materials into the same governed state by reusing the existing server-side
 * product reconciliation path.
 *
 * The product gateway remains the authority for the actual mutation rules:
 * - PF-linked products receive the digital commerce profile;
 * - publication is projected only when the existing PF publication process is
 *   already authoritative/published;
 * - drafts/review/rejected products are never auto-published.
 */
export async function reconcilePerfectFitCommerceAtBoot(
  app,
  { reconcileTenant } = {}
) {
  const runTenantReconciliation =
    typeof reconcileTenant === "function"
      ? reconcileTenant
      : async (tenantId) => {
          // listPerfectFitProducts performs the canonical PF commerce projection
          // reconciliation before returning its read model. limit=1 keeps the
          // incidental read minimal while the reconciliation itself remains tenant-wide.
          await listPerfectFitProducts(app.db, { tenantId, limit: 1 });
        };

  let tenants;
  try {
    const result = await app.db.query(
      `
      SELECT id
      FROM eip_core.tenant
      WHERE is_active = true
      ORDER BY created_at ASC, id ASC
      `
    );
    tenants = result.rows || [];
  } catch (error) {
    app.log?.error?.({
      event: "perfect_fit_commerce_boot_reconcile_failed",
      stage: "tenant_discovery",
      error: error?.message || String(error)
    });
    return {
      ok: false,
      tenants: 0,
      checked: 0,
      failed: 1
    };
  }

  let checked = 0;
  let failed = 0;

  for (const tenant of tenants) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await runTenantReconciliation(tenant.id);
      checked += 1;
    } catch (error) {
      failed += 1;
      app.log?.error?.({
        event: "perfect_fit_commerce_boot_reconcile_tenant_failed",
        tenant_id: tenant.id,
        error: error?.message || String(error)
      });
    }
  }

  const summary = {
    ok: failed === 0,
    tenants: tenants.length,
    checked,
    failed
  };

  app.log?.info?.({
    event: "perfect_fit_commerce_boot_reconcile",
    ...summary
  });

  return summary;
}

export default reconcilePerfectFitCommerceAtBoot;
