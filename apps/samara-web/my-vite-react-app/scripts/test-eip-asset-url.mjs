import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveEipAssetReferences,
  resolveEipAssetUrl
} from '../src/lib/eipAssetUrl.js';

const endpoint = 'https://eip.example.test/api/public/commerce/samara';

test('root-relative EIP asset URLs resolve against the EIP API origin', () => {
  assert.equal(
    resolveEipAssetUrl('/assets/tenant/blog/photo.png?exp=123&token=abc', endpoint),
    'https://eip.example.test/assets/tenant/blog/photo.png?exp=123&token=abc'
  );
});

test('PF-local and external media URLs are not rewritten', () => {
  assert.equal(resolveEipAssetUrl('blob:https://perfectfit.example/123', endpoint), 'blob:https://perfectfit.example/123');
  assert.equal(resolveEipAssetUrl('data:image/png;base64,abc', endpoint), 'data:image/png;base64,abc');
  assert.equal(resolveEipAssetUrl('https://cdn.example.test/photo.png', endpoint), 'https://cdn.example.test/photo.png');
  assert.equal(resolveEipAssetUrl('/local-perfect-fit-image.png', endpoint), '/local-perfect-fit-image.png');
});

test('nested EIP read projections normalize asset references without changing product data', () => {
  const input = {
    item: {
      id: 'product-1',
      title: 'PF-authored product',
      image_url: '/assets/tenant/products/hero.jpg?exp=456&token=def',
      media: {
        images: [
          '/assets/tenant/products/detail.jpg?exp=456&token=ghi',
          'https://external.example/detail.jpg'
        ]
      }
    }
  };

  const result = resolveEipAssetReferences(input, endpoint);

  assert.equal(result.item.id, input.item.id);
  assert.equal(result.item.title, input.item.title);
  assert.equal(
    result.item.image_url,
    'https://eip.example.test/assets/tenant/products/hero.jpg?exp=456&token=def'
  );
  assert.equal(
    result.item.media.images[0],
    'https://eip.example.test/assets/tenant/products/detail.jpg?exp=456&token=ghi'
  );
  assert.equal(result.item.media.images[1], 'https://external.example/detail.jpg');
  assert.notEqual(result, input);
});
