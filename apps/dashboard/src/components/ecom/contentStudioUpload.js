export function approvedStorefrontRendererForZone(zone) {
  if (String(zone?.mappingStatus || "").trim().toLowerCase() !== "approved") return "";
  return String(zone?.rendererType || "").trim().toLowerCase();
}

export async function uploadWorkspaceImageAsset({
  file,
  contentStudioOnly = false,
  openImageStudio,
  imageStudioOptions = {},
  uploadAsset,
  createPreviewUrl,
  onPrepared
} = {}) {
  if (!file) return null;

  // Content Studio already exposes component-level fit, focal point, and
  // overlay controls. Do not hold its upload behind the optional Image Studio
  // modal: in the hosted app that promise can remain pending before any HTTP
  // request is issued. Product Studio continues to use Image Studio.
  const prepared = !contentStudioOnly && typeof openImageStudio === "function"
    ? await openImageStudio(file, imageStudioOptions)
    : file;
  if (!prepared) return null;
  if (typeof uploadAsset !== "function") throw new Error("UPLOAD_HANDLER_REQUIRED");

  const previewUrl = typeof createPreviewUrl === "function"
    ? createPreviewUrl(prepared)
    : "";
  if (typeof onPrepared === "function") {
    await onPrepared({ file: prepared, previewUrl });
  }

  const asset = await uploadAsset(prepared);
  if (!asset?.url) {
    const error = new Error("Upload completed without a stored asset URL.");
    error.code = "UPLOAD_MISSING_URL";
    throw error;
  }

  return { file: prepared, previewUrl, asset };
}
