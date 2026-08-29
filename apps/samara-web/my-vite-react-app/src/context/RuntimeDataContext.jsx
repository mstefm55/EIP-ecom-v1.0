import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import {
  getRuntimeRepositoryRegistry,
  RuntimeRepositoryError
} from '../lib/runtimeDataGateway';
import { ensureDefaultRuntimeRepositories } from '../lib/runtimeRepositoryBootstrap';

const RuntimeDataContext = createContext(null);

export function RuntimeDataProvider({ registry, children }) {
  const resolvedRegistry = useMemo(
    () => registry || ensureDefaultRuntimeRepositories(),
    [registry]
  );
  const value = useMemo(() => ({ registry: resolvedRegistry }), [resolvedRegistry]);

  return (
    <RuntimeDataContext.Provider value={value}>
      {children}
    </RuntimeDataContext.Provider>
  );
}

export function useRuntimeData() {
  return useContext(RuntimeDataContext) || {
    registry: getRuntimeRepositoryRegistry()
  };
}

export function useRuntimeRepository(domain) {
  const { registry } = useRuntimeData();
  return useMemo(() => {
    if (!domain) {
      throw new RuntimeRepositoryError('useRuntimeRepository requires a domain.', {
        operation: 'resolve'
      });
    }
    return registry.get(domain);
  }, [registry, domain]);
}

export function useRuntimeCollection(domain, options = {}) {
  const repository = useRuntimeRepository(domain);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await repository.list(options);
      const normalized = Array.isArray(next) ? next : [];
      setRecords(normalized);
      return normalized;
    } catch (nextError) {
      setError(nextError);
      throw nextError;
    } finally {
      setLoading(false);
    }
  }, [repository, options]);

  useEffect(() => {
    let active = true;
    Promise.resolve(repository.list(options))
      .then((next) => {
        if (active) setRecords(Array.isArray(next) ? next : []);
      })
      .catch((nextError) => {
        if (active) setError(nextError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const unsubscribe = repository.subscribe?.((event) => {
      if (!active) return;
      if (Array.isArray(event?.records)) setRecords(event.records);
      else reload().catch(() => {});
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [repository, options, reload]);

  const create = useCallback(async (input) => repository.create(input), [repository]);
  const update = useCallback(async (id, patch) => repository.update(id, patch), [repository]);
  const upsert = useCallback(async (input) => repository.upsert(input), [repository]);
  const remove = useCallback(async (id) => repository.remove(id), [repository]);
  const replaceAll = useCallback(async (next) => repository.replaceAll(next), [repository]);

  return {
    domain,
    repository,
    records,
    setRecords,
    loading,
    error,
    reload,
    create,
    update,
    upsert,
    remove,
    replaceAll
  };
}

export function useRuntimeDocument(domain) {
  const repository = useRuntimeRepository(domain);
  const [value, setValueState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await repository.get();
      setValueState(next);
      return next;
    } catch (nextError) {
      setError(nextError);
      throw nextError;
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    let active = true;
    Promise.resolve(repository.get())
      .then((next) => {
        if (active) setValueState(next);
      })
      .catch((nextError) => {
        if (active) setError(nextError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const unsubscribe = repository.subscribe?.((event) => {
      if (!active) return;
      if (Object.prototype.hasOwnProperty.call(event || {}, 'value')) {
        setValueState(event.value);
      } else {
        reload().catch(() => {});
      }
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [repository, reload]);

  const setValue = useCallback(async (next) => repository.set(next), [repository]);
  const update = useCallback(async (patch) => repository.update(patch), [repository]);
  const clear = useCallback(async () => repository.clear(), [repository]);

  return {
    domain,
    repository,
    value,
    loading,
    error,
    reload,
    setValue,
    update,
    clear
  };
}

/**
 * React-state compatible document hook used during migration.
 * It preserves existing component setter patterns (including functional setters)
 * while moving persistence behind the runtime repository boundary.
 */
export function useRuntimeState(domain, fallbackValue) {
  const repository = useRuntimeRepository(domain);
  const [state, setState] = useState(fallbackValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.resolve(repository.get())
      .then((next) => {
        if (!active) return;
        setState(next === null || next === undefined ? fallbackValue : next);
      })
      .catch((nextError) => {
        if (active) setError(nextError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const unsubscribe = repository.subscribe?.((event) => {
      if (!active || !Object.prototype.hasOwnProperty.call(event || {}, 'value')) return;
      setState(event.value === null || event.value === undefined ? fallbackValue : event.value);
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [repository]);

  const setRuntimeState = useCallback(
    (nextOrUpdater) => {
      setState((current) => {
        const next =
          typeof nextOrUpdater === 'function'
            ? nextOrUpdater(current)
            : nextOrUpdater;
        Promise.resolve(repository.set(next)).catch((nextError) => setError(nextError));
        return next;
      });
    },
    [repository]
  );

  return [state, setRuntimeState, { loading, error, repository }];
}

/** Collection equivalent of useRuntimeState(). */
export function useRuntimeCollectionState(domain, fallbackRecords = []) {
  const repository = useRuntimeRepository(domain);
  const [records, setRecords] = useState(fallbackRecords);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.resolve(repository.list())
      .then((next) => {
        if (active) setRecords(Array.isArray(next) ? next : fallbackRecords);
      })
      .catch((nextError) => {
        if (active) setError(nextError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const unsubscribe = repository.subscribe?.((event) => {
      if (!active || !Array.isArray(event?.records)) return;
      setRecords(event.records);
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [repository]);

  const setRuntimeRecords = useCallback(
    (nextOrUpdater) => {
      setRecords((current) => {
        const next =
          typeof nextOrUpdater === 'function'
            ? nextOrUpdater(current)
            : nextOrUpdater;
        const normalized = Array.isArray(next) ? next : [];
        Promise.resolve(repository.replaceAll(normalized)).catch((nextError) => setError(nextError));
        return normalized;
      });
    },
    [repository]
  );

  return [records, setRuntimeRecords, { loading, error, repository }];
}
