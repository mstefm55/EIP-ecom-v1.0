import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isBackedByPersistentMount,
  listNonRootMountPoints,
  resolveAssetStorage
} from '../scripts/resolve_asset_storage.mjs';

const rootOnlyMountInfo = '36 25 0:30 / / rw,relatime - overlay overlay rw';
const exactVolumeMountInfo = `${rootOnlyMountInfo}\n48 36 0:45 / /data/eip-assets rw,relatime - ext4 /dev/root rw`;
const parentVolumeMountInfo = `${rootOnlyMountInfo}\n49 36 0:46 / /data rw,relatime - ext4 /dev/root rw`;

test('development keeps the existing local fallback behavior', () => {
  assert.equal(
    resolveAssetStorage({ nodeEnv: 'development', hasDataDir: false, mountInfo: rootOnlyMountInfo }),
    '/app/assets'
  );
  assert.equal(
    resolveAssetStorage({ nodeEnv: 'development', hasDataDir: true, mountInfo: rootOnlyMountInfo }),
    '/data/eip-assets'
  );
});

test('relative configured asset roots remain rooted under /app outside production', () => {
  assert.equal(
    resolveAssetStorage({ assetRoot: 'assets/private', nodeEnv: 'test' }),
    '/app/assets/private'
  );
});

test('unsafe roots are rejected before any ownership change', () => {
  for (const assetRoot of ['/', '/app', '/data']) {
    assert.throws(
      () => resolveAssetStorage({ assetRoot, nodeEnv: 'development' }),
      /Invalid upload root/
    );
  }
});

test('production rejects an asset root backed only by the container filesystem', () => {
  assert.throws(
    () =>
      resolveAssetStorage({
        assetRoot: '/app/assets',
        nodeEnv: 'production',
        mountInfo: rootOnlyMountInfo
      }),
    /mounted persistent volume/
  );
});

test('production accepts the current Railway volume mounted at the asset root', () => {
  assert.equal(
    resolveAssetStorage({
      assetRoot: '/data/eip-assets',
      nodeEnv: 'production',
      mountInfo: exactVolumeMountInfo
    }),
    '/data/eip-assets'
  );
});

test('production accepts an asset root beneath a mounted persistent parent', () => {
  assert.equal(
    resolveAssetStorage({
      assetRoot: '/data/eip-assets',
      nodeEnv: 'production',
      mountInfo: parentVolumeMountInfo
    }),
    '/data/eip-assets'
  );
});

test('mount parsing ignores the container root and supports escaped paths', () => {
  const mountInfo = `${rootOnlyMountInfo}\n50 36 0:47 / /data/eip\\040assets rw,relatime - ext4 /dev/root rw`;
  assert.deepEqual(listNonRootMountPoints(mountInfo), ['/data/eip assets']);
  assert.equal(isBackedByPersistentMount('/data/eip assets/blog', mountInfo), true);
});
