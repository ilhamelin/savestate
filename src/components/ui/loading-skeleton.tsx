export function CatalogueSkeleton() {
  return (
    <div className="game-grid" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="game-card" key={index}>
          <div className="cover skeleton" />
          <div className="game-card-body">
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line skeleton-short" />
          </div>
        </div>
      ))}
    </div>
  );
}
export function LoadingSkeleton({ game = false }: { game?: boolean }) {
  return (
    <div role="status" aria-label="Cargando checkpoint">
      <p className="eyebrow skeleton-heading">CARGANDO CHECKPOINT…</p>
      {game ? (
        <>
          <div className="detail-grid" aria-hidden="true">
            <div className="cover skeleton" />
            <div className="form-stack">
              <div className="skeleton skeleton-line skeleton-title" />
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-panel" />
            </div>
          </div>
          <div className="panel skeleton skeleton-panel" aria-hidden="true" />
        </>
      ) : (
        <CatalogueSkeleton />
      )}
    </div>
  );
}
