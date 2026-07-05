import assert from "node:assert/strict";
import test from "node:test";

import {
  approvedStorefrontRendererForZone,
  uploadWorkspaceImageAsset
} from "../src/components/ecom/contentStudioUpload.js";

test("automatic renderer mapping ignores unapproved scanner proposals", () => {
  assert.equal(
    approvedStorefrontRendererForZone({ mappingStatus: "proposed", rendererType: "rich_text_block" }),
    ""
  );
  assert.equal(
    approvedStorefrontRendererForZone({ mappingStatus: "approved", rendererType: " HERO_SLIDER " }),
    "hero_slider"
  );
});

test("shared workspace uploader supports Image Studio preparation and asset upload", async () => {
  const file = { name: "hero.png", type: "image/png" };
  const editedFile = { name: "hero-edited.webp", type: "image/webp" };
  let editorCalls = 0;

  let uploadedFile = null;
  let preparedPreview = null;
  const result = await uploadWorkspaceImageAsset({
    file,
    openImageStudio: async (source) => {
      assert.equal(source, file);
      editorCalls += 1;
      return editedFile;
    },
    uploadAsset: async (selectedFile) => {
      uploadedFile = selectedFile;
      return { url: "/assets/hero.png" };
    },
    createPreviewUrl: () => "blob:hero",
    onPrepared: ({ previewUrl }) => {
      preparedPreview = previewUrl;
    }
  });

  assert.equal(result.file, editedFile);
  assert.equal(result.asset.url, "/assets/hero.png");
  assert.equal(uploadedFile, editedFile);
  assert.equal(preparedPreview, "blob:hero");
  assert.equal(editorCalls, 1);
});

test("Content Studio starts the shared upload without waiting on the optional image editor", async () => {
  const file = { name: "hero.png", type: "image/png" };
  let uploadedFile = null;
  let editorCalls = 0;

  const result = await Promise.race([
    uploadWorkspaceImageAsset({
      file,
      contentStudioOnly: true,
      openImageStudio: async () => {
        editorCalls += 1;
        return new Promise(() => {});
      },
      uploadAsset: async (selectedFile) => {
        uploadedFile = selectedFile;
        return { url: "/assets/hero.png" };
      }
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("CONTENT_UPLOAD_STALLED")), 100))
  ]);

  assert.equal(editorCalls, 0);
  assert.equal(uploadedFile, file);
  assert.equal(result.asset.url, "/assets/hero.png");
});

test("Content Studio upload failures reject so UI finally handlers can clear loading state", async () => {
  await assert.rejects(
    uploadWorkspaceImageAsset({
      file: { name: "bad.png", type: "image/png" },
      contentStudioOnly: true,
      uploadAsset: async () => {
        const error = new Error("The selected file is invalid.");
        error.code = "INVALID_IMAGE";
        throw error;
      }
    }),
    (error) => error.code === "INVALID_IMAGE"
  );
});

test("Product Studio retains the existing Image Studio preparation flow", async () => {
  const file = { name: "product.png", type: "image/png" };
  const editedFile = { name: "product-edited.webp", type: "image/webp" };
  let receivedOptions = null;

  let uploadedFile = null;
  const result = await uploadWorkspaceImageAsset({
    file,
    openImageStudio: async (source, options) => {
      assert.equal(source, file);
      receivedOptions = options;
      return editedFile;
    },
    imageStudioOptions: { defaultProfileId: "product-card" },
    uploadAsset: async (selectedFile) => {
      uploadedFile = selectedFile;
      return { url: "/assets/product-edited.webp" };
    }
  });

  assert.equal(result.file, editedFile);
  assert.equal(result.asset.url, "/assets/product-edited.webp");
  assert.equal(uploadedFile, editedFile);
  assert.deepEqual(receivedOptions, { defaultProfileId: "product-card" });
});
