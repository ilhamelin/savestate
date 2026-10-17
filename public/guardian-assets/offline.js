/* global indexedDB, document, crypto, navigator, setInterval */
let guardianKey = null;
let currentCode = '';
const code = document.getElementById('code');
const status = document.getElementById('status');
const copy = document.getElementById('copy');
const remaining = document.getElementById('remaining');
function storage(remove = false) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('savestate-guardian', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('settings');
    open.onerror = () => reject(new Error('Storage unavailable'));
    open.onsuccess = () => {
      const db = open.result;
      try {
        const transaction = db.transaction('settings', remove ? 'readwrite' : 'readonly');
        const request = remove
          ? transaction.objectStore('settings').delete('key')
          : transaction.objectStore('settings').get('key');
        transaction.oncomplete = () => {
          db.close();
          resolve(request.result);
        };
        transaction.onerror = transaction.onabort = () => {
          db.close();
          reject(new Error('Storage unavailable'));
        };
      } catch {
        db.close();
        reject(new Error('Storage unavailable'));
      }
    };
  });
}
async function tick() {
  if (!guardianKey) return;
  try {
    const activeKey = guardianKey;
    const now = Date.now();
    const counter = new Uint8Array(8);
    new DataView(counter.buffer).setBigUint64(0, BigInt(Math.floor(now / 20000)));
    const hash = new Uint8Array(await crypto.subtle.sign('HMAC', activeKey, counter));
    if (guardianKey !== activeKey) return;
    const offset = hash[hash.length - 1] & 15;
    currentCode = String(
      (new DataView(hash.buffer).getUint32(offset) & 0x7fffffff) % 1000000,
    ).padStart(6, '0');
    code.textContent = currentCode.slice(0, 3) + ' ' + currentCode.slice(3);
    remaining.value = 20 - (Math.floor(now / 1000) % 20);
    copy.disabled = false;
    status.textContent = remaining.value + 's · Generación local sin conexión';
  } catch {
    status.textContent = 'No se pudo generar la clave. Reactiva Guardian con conexión.';
  }
}
storage()
  .then((key) => {
    guardianKey = key;
    if (!key) {
      status.textContent =
        'Activa este dispositivo desde Guardian con sesión de administrador y conexión.';
      return;
    }
    void tick();
    setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
  })
  .catch(() => {
    status.textContent = 'No hay acceso al almacenamiento del dispositivo.';
  });
copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(currentCode);
    status.textContent = 'Clave copiada.';
  } catch {
    status.textContent = 'Selecciona y copia manualmente la clave.';
  }
});
document.getElementById('forget').addEventListener('click', async () => {
  try {
    await storage(true);
    guardianKey = null;
    currentCode = '';
    code.textContent = '--- ---';
    remaining.value = 0;
    copy.disabled = true;
    status.textContent = 'Dispositivo olvidado.';
  } catch {
    status.textContent = 'No se pudo eliminar la clave local.';
  }
});
