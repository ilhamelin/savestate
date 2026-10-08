export default function Loading() {
  return (
    <div className="panel" aria-busy="true" role="status">
      <p className="eyebrow">SAVESTATE BOARDS</p>
      <h2>Cargando conversaciones…</h2>
      {[1, 2, 3].map((i) => (
        <div key={i} className="forum-skeleton" />
      ))}
    </div>
  );
}
