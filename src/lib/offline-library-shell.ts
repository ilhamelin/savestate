'use client';
export async function prepareOfflineLibraryShell() {
  if (!('serviceWorker' in navigator))
    throw new Error('Este navegador no admite el acceso sin conexión.');
  const registration = await navigator.serviceWorker.register('/library-sw.js', { scope: '/' });
  if (registration.active?.state === 'activated') return;
  const worker = registration.installing ?? registration.waiting ?? registration.active;
  if (!worker) throw new Error('No se pudo preparar la pantalla offline.');
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(
      () => finish(new Error('No se pudo preparar el acceso offline. Inténtalo de nuevo.')),
      15000,
    );
    const check = () => {
      if (worker.state === 'activated') finish();
      else if (worker.state === 'redundant')
        finish(new Error('No se pudo instalar la pantalla offline.'));
    };
    function finish(error?: Error) {
      window.clearTimeout(timer);
      worker!.removeEventListener('statechange', check);
      if (error) reject(error);
      else resolve();
    }
    worker.addEventListener('statechange', check);
    check();
  });
}
