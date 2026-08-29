/**
 * Materials aggregate persistence adapter.
 *
 * React components work with this load/save contract; local browser persistence
 * is only the development adapter. A future EIP adapter implements the same
 * contract without changing the Materials UI.
 */

import { perfectFitMetadata } from '../config/perfectFitMetadata';
import { runtimeDataStorage } from './runtimeDataGateway';

const materialsMetadata = perfectFitMetadata.materials;

const DEFAULT_DOMAIN = Object.freeze({
  materials: [],
  suppliers: [],
  incoming: [],
  receipts: [],
  issues: []
});

function clone(value) {
  try {
    return typeof structuredClone === 'function'
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : clone(fallback);
  } catch {
    return clone(fallback);
  }
}

const readArray = (storage, key, fallback = []) => {
  const value = safeParse(storage?.getItem?.(key), fallback);
  return Array.isArray(value) ? value : clone(fallback);
};

const writeArray = (storage, key, value) => {
  storage?.setItem?.(key, JSON.stringify(Array.isArray(value) ? value : []));
};

export function createLocalMaterialsRepository(
  metadata = materialsMetadata,
  storage = runtimeDataStorage
) {
  const keys = metadata.storage || {};

  const load = () => {
    const suppliers = readArray(storage, keys.suppliers, []);
    const legacySuppliers = suppliers.length
      ? suppliers
      : readArray(storage, keys.legacySuppliers, []);

    return {
      materials: readArray(storage, keys.materials, []),
      suppliers: legacySuppliers,
      incoming: readArray(storage, keys.incoming, []),
      receipts: readArray(storage, keys.goodsReceipts, []),
      issues: readArray(storage, keys.materialIssues, [])
    };
  };

  const save = (domain = DEFAULT_DOMAIN) => {
    writeArray(storage, keys.materials, domain.materials);
    writeArray(storage, keys.suppliers, domain.suppliers);
    writeArray(storage, keys.incoming, domain.incoming);
    writeArray(storage, keys.goodsReceipts, domain.receipts);
    writeArray(storage, keys.materialIssues, domain.issues);
    return clone(domain);
  };

  return {
    mode: 'LOCAL',
    authority: 'CLIENT_ADAPTER',
    load,
    save
  };
}

export function createEipMaterialsRepository({ load, save, subscribe } = {}) {
  if (typeof load !== 'function' || typeof save !== 'function') {
    throw new Error('EIP Materials repository requires load() and save().');
  }

  return {
    mode: 'EIP',
    authority: 'EIP',
    load: (...args) => Promise.resolve(load(...args)),
    save: (...args) => Promise.resolve(save(...args)),
    subscribe: typeof subscribe === 'function' ? subscribe : () => () => {}
  };
}

/** Backward-compatible name retained for existing imports. */
export function createUnconfiguredEipMaterialsRepository() {
  return {
    mode: 'EIP',
    authority: 'EIP',
    load() {
      throw new Error(
        'EIP Materials repository is not configured yet. Inject the EIP adapter through the repository prop.'
      );
    },
    save() {
      throw new Error(
        'EIP Materials repository is not configured yet. Inject the EIP adapter through the repository prop.'
      );
    }
  };
}
