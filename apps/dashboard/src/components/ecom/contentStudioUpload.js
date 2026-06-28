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

  // Content Studio already exposes fit, focal point, and overlay controls. Upload
  // immediately so its request cannot be held open by the optional editor modal.
  const prepared = contentStudioOnly || typeof openImageStudio !== "function"
    ? file
    : await openImageStudio(file, imageStudioOptions);
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
