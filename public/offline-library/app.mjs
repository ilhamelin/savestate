/* global document, navigator, window */
import { readOfflineLibrary, revokeOfflineLibrary, subscribeOfflineLibrary, synchronizeOfflineLibraryAccount } from './store.mjs';
const element = id => document.getElementById(id);
const labels = { playing: 'Jugando', backlog: 'Backlog', cleared: 'Completado', platinum: '100% Platinum', dropped: 'Abandonado', wishlist: 'Deseado' };
let snapshot = null, revision = 0, expiryTimer, request;
function hide() {
  snapshot = null;
  element('rows').replaceChildren();
  element('summary').textContent = '';
  element('last-sync').textContent = 'Sin copia offline vigente';
  element('clear').disabled = true;
  element('empty').hidden = false;
  clearTimeout(expiryTimer);
}
function render() {
  element('rows').replaceChildren();
  if (!snapshot) return;
  const query = element('search').value.trim().toLocaleLowerCase('es');
  const status = element('filter').value;
  const rows = snapshot.rows.filter(row => row.title.toLocaleLowerCase('es').includes(query) && (status === 'all' || row.status === status));
  for (const row of rows) {
    const card = document.createElement('article'), title = document.createElement('h2');
    title.textContent = row.title;
    const badge = document.createElement('span'); badge.className = 'tag'; badge.textContent = labels[row.status];
    const progress = document.createElement('p');
    progress.textContent = row.hours + ' h · ' + row.sessions + ' partidas' + (row.rating ? ' · ★ ' + row.rating + '/10' : '');
    const platforms = document.createElement('small'); platforms.textContent = row.platforms.join(' · ');
    card.append(title, badge, progress, platforms);
    element('rows').append(card);
  }
  element('summary').textContent = rows.length + ' visibles · ' + snapshot.rows.length + ' de ' + snapshot.totalCount + ' juegos guardados';
  element('empty').hidden = rows.length > 0;
  element('empty').textContent = snapshot.rows.length ? 'No hay juegos que coincidan con estos filtros.' : 'Tu copia no contiene juegos.';
}
async function load() {
  const version = ++revision;
  request?.abort();
  request = new AbortController();
  hide();
  const online = navigator.onLine !== false;
  element('connection').textContent = online ? '● Online · Copia de solo lectura' : '○ Modo Offline · Copia de solo lectura';
  element('connection').className = online ? 'online' : 'offline';
  let owner;
  try {
    if (online) {
      try {
        const response = await fetch('/api/library/offline-access', { cache: 'no-store', signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]) });
        if (version !== revision) return;
        if (response.status === 401 || response.status === 403) {
          await revokeOfflineLibrary();
          element('status').textContent = 'Tu sesión necesita validarse. Abre la biblioteca online para continuar.';
          return;
        }
        if (!response.ok) { element('status').textContent = 'No pudimos validar el acceso. Reintenta cuando el servicio se recupere.'; return; }
        const result = await response.json();
        if (typeof result.userId !== 'string') return;
        owner = result.userId;
        await synchronizeOfflineLibraryAccount(owner);
      } catch {
        if (request.signal.aborted || version !== revision) return;
        element('connection').textContent = '○ Modo Offline · Sin respuesta de la red';
        element('connection').className = 'offline';
      }
    }
    const value = await readOfflineLibrary(owner);
    if (version !== revision) return;
    if (!value) { element('status').textContent = 'No hay una copia vigente para esta cuenta. Guárdala de nuevo desde la biblioteca online.'; return; }
    snapshot = value;
    element('last-sync').textContent = 'Última sincronización: ' + new Date(value.savedAt).toLocaleString('es-CL');
    element('status').textContent = 'Copia local válida durante 12 horas. Las actualizaciones se preparan desde la biblioteca online.';
    element('clear').disabled = false;
    expiryTimer = setTimeout(() => { hide(); element('status').textContent = 'La copia ha caducado. Actualízala con conexión.'; }, Math.max(0, Date.parse(value.expiresAt) - Date.now() + 1));
    render();
  } catch { if (version === revision) element('status').textContent = 'Este navegador no permite acceder al almacenamiento offline.'; }
}
element('search').addEventListener('input', render);
element('filter').addEventListener('change', render);
element('clear').addEventListener('click', async () => {
  revision++; request?.abort(); hide();
  try { await revokeOfflineLibrary(); element('status').textContent = 'Copia eliminada de este dispositivo.'; }
  catch { element('status').textContent = 'La copia ha sido bloqueada. Revisa el almacenamiento del navegador para completar su eliminación.'; }
});
const unsubscribe = subscribeOfflineLibrary(() => { revision++; request?.abort(); hide(); element('status').textContent = 'La sesión o la copia cambió. Abre de nuevo tu biblioteca.'; });
window.addEventListener('online', load);
window.addEventListener('offline', load);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void load(); });
window.addEventListener('pagehide', event => {
  revision++; request?.abort(); hide();
  if (!event.persisted) unsubscribe();
});
window.addEventListener('pageshow', event => { if (event.persisted) void load(); });
void load();
