export default function Loading() {
  return (
    <section aria-label="Cargando convocatorias" aria-busy="true" className="party-grid">
      {[1, 2, 3, 4].map((id) => (
        <div className="panel skeleton" style={{ minHeight: 260 }} key={id} />
      ))}
    </section>
  );
}
