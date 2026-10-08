'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="panel">
      <h1>No pudimos cargar el foro.</h1>
      <p>
        Inténtalo nuevamente. Si estás configurando el módulo, comprueba que la migración 011 esté
        aplicada.
      </p>
      <button className="button" type="button" onClick={reset}>
        Reintentar
      </button>
    </section>
  );
}
