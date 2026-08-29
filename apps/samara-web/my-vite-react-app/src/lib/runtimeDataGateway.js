/**
 * Perfect Fit runtime-data gateway.
 *
 * Static UI/governance metadata belongs in perfectFitMetadata.js.
 * Runtime business records (products, reviews, orders, projects, messages, etc.)
 * are accessed through this repository boundary.
 *
 * The LOCAL adapters intentionally preserve the existing JSON storage shape so
 * the migration does not destroy browser data. Future EIP/Fastify adapters can
 * implement the same async contract without changing React consumers.
 */

const isBrowser = () => typeof window !== 'undefined';
const nowIso = () => new Date().toISOString();

const clone = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {}
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
};

const safeParse = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return clone(fallback);
  try {
    return JSON.parse(value);
  } catch {
    return clone(fallback);
  }
};

const getDefaultStorage = () => (isBrowser() ? window.localStorage : null);

export const createClientRecordId = (prefix = 'client') => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const RUNTIME_REPOSITORY_MODE = Object.freeze({
  LOCAL: 'LOCAL',
  EIP: 'EIP',
  CUSTOM: 'CUSTOM'
});

export class RuntimeRepositoryError extends Error {
  constructor(message, { domain = '', operation = '', cause = null } = {}) {
    super(message);
    this.name = 'RuntimeRepositoryError';
    this.domain = domain;
    this.operation = operation;
    this.cause = cause;
  }
}

export function createRepositoryChannel() {
  const listeners = new Set();
  return {
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(event) {
      listeners.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          console.error('[PerfectFit runtime repository listener]', error);
        }
      });
    },
    clear() {
      listeners.clear();
    }
  };
}

/** Document/value repository for profile objects, review maps, etc. */
export function createLocalValueRepository({
  domain,
  storageKey,
  seed = null,
  storage = getDefaultStorage(),
  normalize = null
}) {
  if (!domain) throw new Error('createLocalValueRepository requires domain.');
  if (!storageKey) throw new Error(`Local repository ${domain} requires storageKey.`);
  const channel = createRepositoryChannel();

  const normalizeValue = (value) => {
    const next = clone(value);
    return typeof normalize === 'function' ? normalize(next) : next;
  };

  const read = () => {
    if (!storage) return normalizeValue(seed);
    const raw = storage.getItem(storageKey);
    return normalizeValue(safeParse(raw, seed));
  };

  const write = (value, reason = 'set') => {
    const next = normalizeValue(value);
    if (storage) storage.setItem(storageKey, JSON.stringify(next));
    channel.emit({ domain, reason, updatedAt: nowIso(), value: clone(next) });
    return clone(next);
  };

  return {
    domain,
    shape: 'document',
    mode: RUNTIME_REPOSITORY_MODE.LOCAL,
    storageKey,
    async get() {
      return clone(read());
    },
    async set(value) {
      return write(value, 'set');
    },
    async update(patch) {
      const current = read();
      const next =
        current && typeof current === 'object' && !Array.isArray(current)
          ? { ...current, ...clone(patch) }
          : clone(patch);
      return write(next, 'update');
    },
    async clear() {
      if (storage) storage.removeItem(storageKey);
      channel.emit({ domain, reason: 'clear', updatedAt: nowIso(), value: clone(seed) });
    },
    subscribe(listener) {
      return channel.subscribe(listener);
    }
  };
}

/** Collection repository. Existing raw-array localStorage payloads remain valid. */
export function createLocalCollectionRepository({
  domain,
  storageKey,
  seed = [],
  storage = getDefaultStorage(),
  normalize = null,
  idPrefix = domain || 'record'
}) {
  if (!domain) throw new Error('createLocalCollectionRepository requires domain.');
  if (!storageKey) throw new Error(`Local repository ${domain} requires storageKey.`);
  const channel = createRepositoryChannel();

  const normalizeRecord = (record) => {
    const next = clone(record || {});
    return typeof normalize === 'function' ? normalize(next) : next;
  };

  const normalizeRecords = (records) =>
    (Array.isArray(records) ? records : []).map(normalizeRecord);

  const read = () => {
    if (!storage) return normalizeRecords(seed);
    const parsed = safeParse(storage.getItem(storageKey), null);
    // Compatibility with the short-lived envelope format used during migration testing.
    const records = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.records)
        ? parsed.records
        : seed;
    return normalizeRecords(records);
  };

  const write = (records, reason = 'replace') => {
    const next = normalizeRecords(records);
    if (storage) storage.setItem(storageKey, JSON.stringify(next));
    channel.emit({ domain, reason, updatedAt: nowIso(), records: clone(next) });
    return clone(next);
  };

  return {
    domain,
    shape: 'collection',
    mode: RUNTIME_REPOSITORY_MODE.LOCAL,
    storageKey,
    async list({ predicate = null } = {}) {
      const records = read();
      return clone(typeof predicate === 'function' ? records.filter(predicate) : records);
    },
    async getById(id) {
      if (id === null || id === undefined) return null;
      const records = read();
      return clone(records.find((record) => String(record?.id) === String(id)) || null);
    },
    async create(input = {}) {
      const records = read();
      const timestamp = nowIso();
      const record = normalizeRecord({
        ...clone(input),
        id: input?.id || createClientRecordId(idPrefix),
        createdAt: input?.createdAt || timestamp,
        updatedAt: timestamp,
        _clientPending: input?._clientPending ?? true
      });
      if (records.some((item) => String(item?.id) === String(record.id))) {
        throw new RuntimeRepositoryError(`Duplicate ${domain} id: ${record.id}`, {
          domain,
          operation: 'create'
        });
      }
      write([...records, record], 'create');
      return clone(record);
    },
    async update(id, patch = {}) {
      const records = read();
      const index = records.findIndex((record) => String(record?.id) === String(id));
      if (index < 0) return null;
      const next = normalizeRecord({
        ...records[index],
        ...clone(patch),
        id: records[index].id,
        updatedAt: nowIso(),
        _clientPending: patch?._clientPending ?? true
      });
      const updated = [...records];
      updated[index] = next;
      write(updated, 'update');
      return clone(next);
    },
    async upsert(input = {}) {
      if (!input?.id) return this.create(input);
      const existing = await this.getById(input.id);
      return existing ? this.update(input.id, input) : this.create(input);
    },
    async remove(id) {
      const records = read();
      const next = records.filter((record) => String(record?.id) !== String(id));
      if (next.length === records.length) return false;
      write(next, 'remove');
      return true;
    },
    async replaceAll(records) {
      return write(records, 'replace');
    },
    async clear() {
      if (storage) storage.removeItem(storageKey);
      channel.emit({ domain, reason: 'clear', updatedAt: nowIso(), records: [] });
    },
    subscribe(listener) {
      return channel.subscribe(listener);
    }
  };
}

/**
 * EIP collection adapter shell. Endpoint paths are deliberately NOT defined here.
 * Supply actual Fastify client functions when the EIP API contract is ready.
 */
export function createEipRepository({
  domain,
  list,
  getById,
  create,
  update,
  upsert,
  remove,
  replaceAll,
  subscribe
}) {
  if (!domain) throw new Error('createEipRepository requires domain.');
  const required = { list, getById, create, update, remove };
  Object.entries(required).forEach(([name, fn]) => {
    if (typeof fn !== 'function') {
      throw new Error(`EIP repository ${domain} is missing ${name}().`);
    }
  });
  return {
    domain,
    shape: 'collection',
    mode: RUNTIME_REPOSITORY_MODE.EIP,
    list: (...args) => Promise.resolve(list(...args)),
    getById: (...args) => Promise.resolve(getById(...args)),
    create: (...args) => Promise.resolve(create(...args)),
    update: (...args) => Promise.resolve(update(...args)),
    upsert:
      typeof upsert === 'function'
        ? (...args) => Promise.resolve(upsert(...args))
        : async (input) => {
            if (!input?.id) return create(input);
            const existing = await getById(input.id);
            return existing ? update(input.id, input) : create(input);
          },
    remove: (...args) => Promise.resolve(remove(...args)),
    replaceAll:
      typeof replaceAll === 'function'
        ? (...args) => Promise.resolve(replaceAll(...args))
        : undefined,
    subscribe: typeof subscribe === 'function' ? subscribe : () => () => {}
  };
}

export function createEipValueRepository({ domain, get, set, update, clear, subscribe }) {
  if (!domain) throw new Error('createEipValueRepository requires domain.');
  if (typeof get !== 'function' || typeof set !== 'function') {
    throw new Error(`EIP value repository ${domain} requires get() and set().`);
  }
  return {
    domain,
    shape: 'document',
    mode: RUNTIME_REPOSITORY_MODE.EIP,
    get: (...args) => Promise.resolve(get(...args)),
    set: (...args) => Promise.resolve(set(...args)),
    update:
      typeof update === 'function'
        ? (...args) => Promise.resolve(update(...args))
        : async (patch) => set({ ...(await get()), ...patch }),
    clear: typeof clear === 'function' ? (...args) => Promise.resolve(clear(...args)) : async () => set(null),
    subscribe: typeof subscribe === 'function' ? subscribe : () => () => {}
  };
}

export function createRepositoryRegistry(initialRepositories = {}) {
  const repositories = new Map(Object.entries(initialRepositories));
  const listeners = new Set();
  const notify = (domain, repository) => listeners.forEach((listener) => listener({ domain, repository }));

  return {
    register(domain, repository) {
      if (!domain) throw new Error('Repository domain is required.');
      if (!repository) throw new Error(`Repository ${domain} is required.`);
      repositories.set(domain, repository);
      notify(domain, repository);
      return repository;
    },
    registerMany(map = {}) {
      Object.entries(map).forEach(([domain, repository]) => this.register(domain, repository));
      return this;
    },
    get(domain) {
      const repository = repositories.get(domain);
      if (!repository) {
        throw new RuntimeRepositoryError(`Runtime repository not registered for domain: ${domain}`, {
          domain,
          operation: 'resolve'
        });
      }
      return repository;
    },
    has(domain) {
      return repositories.has(domain);
    },
    entries() {
      return [...repositories.entries()];
    },
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

let activeRuntimeRepositoryRegistry = createRepositoryRegistry();

export function configureRuntimeRepositories(registryOrMap) {
  activeRuntimeRepositoryRegistry =
    registryOrMap && typeof registryOrMap.get === 'function'
      ? registryOrMap
      : createRepositoryRegistry(registryOrMap || {});
  return activeRuntimeRepositoryRegistry;
}

export const getRuntimeRepositoryRegistry = () => activeRuntimeRepositoryRegistry;
export const getRuntimeRepository = (domain) => activeRuntimeRepositoryRegistry.get(domain);

/**
 * Transitional Web-Storage-compatible bridge.
 *
 * All migrated business components use this instead of localStorage directly.
 * It preserves the existing serialized payload today and creates one interception
 * point for EIP synchronization. UI-only preferences should use clientPreferences.
 */
const runtimeStorageChannel = createRepositoryChannel();
let runtimeStorageKeyToDomain = Object.create(null);
let runtimeStorageRemoteBridge = null;

export function configureRuntimeStorageDomains(domainContracts = {}) {
  const entries = [];

  Object.entries(domainContracts).forEach(([domain, contract]) => {
    if (contract?.storageKey) entries.push([contract.storageKey, domain]);
    (Array.isArray(contract?.legacyKeys) ? contract.legacyKeys : []).forEach((key) => {
      if (key) entries.push([key, domain]);
    });
  });

  runtimeStorageKeyToDomain = Object.fromEntries(entries);
  return runtimeStorageKeyToDomain;
}

export function configureRuntimeStorageRemoteBridge(bridge = null) {
  runtimeStorageRemoteBridge = bridge;
}

const remoteNotify = (operation, key, value = null) => {
  const domain = runtimeStorageKeyToDomain[key] || null;
  runtimeStorageChannel.emit({ operation, key, domain, value, updatedAt: nowIso() });
  if (!domain || !runtimeStorageRemoteBridge) return;
  try {
    Promise.resolve(
      runtimeStorageRemoteBridge({ operation, key, domain, value })
    ).catch((error) => console.error('[PerfectFit EIP runtime bridge]', error));
  } catch (error) {
    console.error('[PerfectFit EIP runtime bridge]', error);
  }
};

export const runtimeDataStorage = {
  getItem(key) {
    return getDefaultStorage()?.getItem(key) ?? null;
  },
  setItem(key, value) {
    getDefaultStorage()?.setItem(key, String(value));
    remoteNotify('setItem', key, String(value));
  },
  removeItem(key) {
    getDefaultStorage()?.removeItem(key);
    remoteNotify('removeItem', key, null);
  },
  subscribe(listener) {
    return runtimeStorageChannel.subscribe(listener);
  },
  domainForKey(key) {
    return runtimeStorageKeyToDomain[key] || null;
  }
};
