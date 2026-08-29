/**
 * Browser binary cache adapter.
 *
 * This module is intentionally a CLIENT CACHE, not business-data authority.
 * Asset metadata/ownership/revisions belong in EIP repositories. IndexedDB is
 * used only to keep large Blob/File payloads available while running locally
 * or offline before the EIP asset service is connected.
 */

const hasIndexedDb = () =>
  typeof window !== 'undefined' && Boolean(window.indexedDB);

export function createIndexedDbRecordStore({
  dbName,
  storeName,
  version = 1,
  keyPath = 'id'
}) {
  if (!dbName || !storeName) {
    throw new Error('createIndexedDbRecordStore requires dbName and storeName.');
  }

  const open = () =>
    new Promise((resolve, reject) => {
      if (!hasIndexedDb()) {
        resolve(null);
        return;
      }

      const request = window.indexedDB.open(dbName, version);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName, { keyPath });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

  const transact = async (mode, operation) => {
    const database = await open();
    if (!database) return null;

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      let operationResult = null;

      try {
        operationResult = operation(store, transaction);
      } catch (error) {
        database.close();
        reject(error);
        return;
      }

      transaction.oncomplete = () => {
        database.close();
        resolve(operationResult);
      };
      transaction.onerror = () => {
        const error = transaction.error;
        database.close();
        reject(error);
      };
      transaction.onabort = () => {
        const error = transaction.error || new Error(`IndexedDB transaction aborted: ${dbName}/${storeName}`);
        database.close();
        reject(error);
      };
    });
  };

  return {
    dbName,
    storeName,
    async put(record) {
      if (!record || record[keyPath] === undefined || record[keyPath] === null) {
        throw new Error(`IndexedDB record requires ${keyPath}.`);
      }
      await transact('readwrite', (store) => {
        store.put(record);
        return record;
      });
      return record;
    },
    async get(id) {
      const database = await open();
      if (!database) return null;

      return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, 'readonly');
        const request = transaction.objectStore(storeName).get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => database.close();
        transaction.onerror = () => {
          const error = transaction.error;
          database.close();
          reject(error);
        };
      });
    },
    async remove(id) {
      await transact('readwrite', (store) => {
        store.delete(id);
        return true;
      });
      return true;
    }
  };
}
