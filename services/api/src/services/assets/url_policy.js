function normalizeText(value) {
  return String(value || "").trim();
}

function toLocalAssetPath(value) {
  const text = normalizeText(value);
  if (!text) return "";
  try {
    const parsed = new URL(text, "http://local");
    return parsed.pathname.startsWith("/assets/") ? parsed.pathname : "";
  } catch {
    return "";
  }
}

function tenantAssetPrefix(tenantId) {
  return `/assets/${normalizeText(tenantId)}/`;
}

function isTenantAssetPath(path, tenantId) {
  const localPath = normalizeText(path);
  const prefix = tenantAssetPrefix(tenantId);
  return Boolean(localPath && prefix !== "/assets//" && localPath.startsWith(prefix));
}

function sanitizeAssetUrlForStorage(value, tenantId) {
  const text = normalizeText(value);
  if (!text) return text;
  const localPath = toLocalAssetPath(text);
  if (!localPath) return text;
  if (!isTenantAssetPath(localPath, tenantId)) {
    throw new Error("ASSET_TENANT_MISMATCH");
  }
  return localPath;
}

function sanitizeMediaForStorage(media, tenantId) {
  if (!media || typeof media !== "object") return media;
  const next = { ...media };

  if (next.main_url) next.main_url = sanitizeAssetUrlForStorage(next.main_url, tenantId);
  if (next.hero_url) next.hero_url = sanitizeAssetUrlForStorage(next.hero_url, tenantId);

  if (next.main_asset && typeof next.main_asset === "object" && next.main_asset.url) {
    next.main_asset = {
      ...next.main_asset,
      url: sanitizeAssetUrlForStorage(next.main_asset.url, tenantId)
    };
  }
  if (next.hero_asset && typeof next.hero_asset === "object" && next.hero_asset.url) {
    next.hero_asset = {
      ...next.hero_asset,
      url: sanitizeAssetUrlForStorage(next.hero_asset.url, tenantId)
    };
  }

  if (Array.isArray(next.gallery)) {
    next.gallery = next.gallery
      .map((url) => sanitizeAssetUrlForStorage(url, tenantId))
      .filter(Boolean);
  }
  if (Array.isArray(next.documents)) {
    next.documents = next.documents
      .map((url) => sanitizeAssetUrlForStorage(url, tenantId))
      .filter(Boolean);
  }

  if (Array.isArray(next.gallery_assets)) {
    next.gallery_assets = next.gallery_assets
      .map((asset) => {
        if (!asset || typeof asset !== "object") return asset;
        if (!asset.url) return asset;
        return {
          ...asset,
          url: sanitizeAssetUrlForStorage(asset.url, tenantId)
        };
      })
      .filter(Boolean);
  }

  if (Array.isArray(next.document_assets)) {
    next.document_assets = next.document_assets
      .map((asset) => {
        if (!asset || typeof asset !== "object") return asset;
        if (!asset.url) return asset;
        return {
          ...asset,
          url: sanitizeAssetUrlForStorage(asset.url, tenantId)
        };
      })
      .filter(Boolean);
  }

  return next;
}

export {
  isTenantAssetPath,
  sanitizeAssetUrlForStorage,
  sanitizeMediaForStorage,
  toLocalAssetPath
};
