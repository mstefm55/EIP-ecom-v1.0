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

test("Content Studio sends the selected image directly without waiting for Image Studio", async () => {
  const file = { name: "hero.png", type: "image/png" };
  let editorCalls = 0;

  let uploadedFile = null;
  let preparedPreview = null;
  const result = await uploadWorkspaceImageAsset({
    file,
    contentStudioOnly: true,
    openImageStudio: async () => {
      editorCalls += 1;
      return new Promise(() => {});
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

  assert.equal(result.file, file);
  assert.equal(result.asset.url, "/assets/hero.png");
  assert.equal(uploadedFile, file);
  assert.equal(preparedPreview, "blob:hero");
  assert.equal(editorCalls, 0);
});

test("Product Studio retains the existing Image Studio preparation flow", async () => {
  const file = { name: "product.png", type: "image/png" };
  const editedFile = { name: "product-edited.webp", type: "image/webp" };
  let receivedOptions = null;

  let uploadedFile = null;
  const result = await uploadWorkspaceImageAsset({
    file,
    contentStudioOnly: false,
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
