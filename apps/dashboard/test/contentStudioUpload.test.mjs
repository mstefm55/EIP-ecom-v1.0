import assert from "node:assert/strict";
import test from "node:test";

import { prepareWorkspaceImageUpload } from "../src/components/ecom/contentStudioUpload.js";

test("Content Studio sends the selected image directly without waiting for Image Studio", async () => {
  const file = { name: "hero.png", type: "image/png" };
  let editorCalls = 0;

  const prepared = await prepareWorkspaceImageUpload({
    file,
    contentStudioOnly: true,
    openImageStudio: async () => {
      editorCalls += 1;
      return new Promise(() => {});
    }
  });

  assert.equal(prepared, file);
  assert.equal(editorCalls, 0);
});

test("Product Studio retains the existing Image Studio preparation flow", async () => {
  const file = { name: "product.png", type: "image/png" };
  const editedFile = { name: "product-edited.webp", type: "image/webp" };
  let receivedOptions = null;

  const prepared = await prepareWorkspaceImageUpload({
    file,
    contentStudioOnly: false,
    openImageStudio: async (source, options) => {
      assert.equal(source, file);
      receivedOptions = options;
      return editedFile;
    },
    imageStudioOptions: { defaultProfileId: "product-card" }
  });

  assert.equal(prepared, editedFile);
  assert.deepEqual(receivedOptions, { defaultProfileId: "product-card" });
});
