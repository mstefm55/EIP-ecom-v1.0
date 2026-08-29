import assert from 'node:assert/strict';
import {
  RuntimeRepositoryError,
  createEipRepository,
  createLocalCollectionRepository,
  createRepositoryRegistry
} from '../src/lib/runtimeDataGateway.js';

const createMemoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
};

const storage = createMemoryStorage();
const catalog = createLocalCollectionRepository({
  domain: 'catalogProducts',
  storageKey: 'test_catalog_products',
  seed: [],
  storage
});
const registry = createRepositoryRegistry({ catalogProducts: catalog });

assert.deepEqual(await registry.get('catalogProducts').list(), []);

const suppliedRecord = {
  id: 'db-product-001',
  name: 'Repository supplied pattern',
  category: 'Dresses',
  price: 18
};
await registry.get('catalogProducts').create(suppliedRecord);
const renderedRecords = await registry.get('catalogProducts').list();
assert.equal(renderedRecords.length, 1);
assert.equal(renderedRecords[0].name, suppliedRecord.name);
assert.equal(renderedRecords.some((record) => String(record.id).startsWith('sartorial-')), false);

const adapterFailure = new Error('repository offline');
const failingRepository = createEipRepository({
  domain: 'catalogProducts',
  list: async () => { throw adapterFailure; },
  getById: async () => null,
  create: async () => null,
  update: async () => null,
  remove: async () => false
});
await assert.rejects(() => failingRepository.list(), adapterFailure);

assert.throws(
  () => registry.get('missingDomain'),
  (error) => error instanceof RuntimeRepositoryError && error.operation === 'resolve'
);

console.log(JSON.stringify({
  ok: true,
  emptyRepository: true,
  suppliedRecord: renderedRecords[0].id,
  adapterErrorsRemainObservable: true
}, null, 2));
