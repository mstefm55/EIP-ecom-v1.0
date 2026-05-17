// src/auth/perm.js

/**
 * Returns true if identity has the permission via any assigned role.
 * Uses: eip_authz.identity_role + eip_authz.role_permission
 */
export async function hasPermission(app, tenantId, identityId, permissionCode) {
  const r = await app.db.query(
    `
    SELECT 1
    WHERE EXISTS (
      SELECT 1
      FROM eip_authz.identity_role ir
      JOIN eip_authz.role_permission rp ON rp.role_id = ir.role_id
      WHERE ir.tenant_id = $1
        AND ir.identity_id = $2
        AND rp.permission_code = $3
    )
    OR EXISTS (
      SELECT 1
      FROM eip_authz.identity_permission ip
      WHERE ip.tenant_id = $1
        AND ip.identity_id = $2
        AND ip.permission_code = $3
    )
    LIMIT 1
    `,
    [tenantId, identityId, permissionCode]
  );
  return r.rowCount === 1;
}
