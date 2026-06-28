export async function prepareWorkspaceImageUpload({
  file,
  contentStudioOnly = false,
  openImageStudio,
  imageStudioOptions = {}
} = {}) {
  if (!file) return null;

  // Content Studio already exposes fit, focal point, and overlay controls. Upload
  // immediately so its request cannot be held open by the optional editor modal.
  if (contentStudioOnly || typeof openImageStudio !== "function") return file;

  return openImageStudio(file, imageStudioOptions);
}
