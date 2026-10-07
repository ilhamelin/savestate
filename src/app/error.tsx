'use client';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="empty-state" role="alert">
      <h1>No se pudo cargar este checkpoint.</h1>
      <p>Revisa la conexión y vuelve a intentarlo.</p>
      <button className="button" onClick={reset}>
        Reintentar
      </button>
    </div>
  );
}
