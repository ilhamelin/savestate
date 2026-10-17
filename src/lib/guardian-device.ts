const DATABASE = 'savestate-guardian';
async function deviceStore<T>(
  action: (store: IDBObjectStore) => IDBRequest<T>,
  mode: IDBTransactionMode,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DATABASE, 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore('settings');
    };
    open.onerror = () =>
      reject(new Error('El navegador no permite guardar Guardian en este dispositivo.'));
    open.onsuccess = () => {
      const db = open.result;
      try {
        const transaction = db.transaction('settings', mode);
        const result = action(transaction.objectStore('settings'));
        transaction.oncomplete = () => {
          db.close();
          resolve(result.result);
        };
        transaction.onerror = transaction.onabort = () => {
          db.close();
          reject(new Error('No se pudo guardar Guardian en el dispositivo.'));
        };
      } catch {
        db.close();
        reject(new Error('Este navegador no permite guardar la clave local de Guardian.'));
      }
    };
  });
}
export async function loadGuardianKey(): Promise<CryptoKey | null> {
  const value = await deviceStore((store) => store.get('key'), 'readonly');
  return value instanceof CryptoKey ? value : null;
}
export async function saveGuardianKey(key: CryptoKey) {
  await deviceStore((store) => store.put(key, 'key'), 'readwrite');
}
export async function removeGuardianKey() {
  await deviceStore((store) => store.delete('key'), 'readwrite');
}
