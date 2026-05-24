function normalizeText(value) {
  return String(value || "").trim();
}

function sessionCanAccessAssetTenant(session, assetTenantId, accessCtx = null) {
  if (!session) return false;
  const realm = normalizeText(session.realm || session.attrs?.realm || "EIP").toUpperCase();
  if (realm !== "EIP") return false;
  if (normalizeText(session.tenant_id) === normalizeText(assetTenantId)) return true;
  return accessCtx?.is_owner_admin_session === true;
}

export { sessionCanAccessAssetTenant };
