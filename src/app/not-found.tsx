import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="empty-state">
      <p className="eyebrow">ERROR 404</p>
      <h1>Checkpoint no encontrado.</h1>
      <Link href="/explore" className="button">
        Volver al catálogo
      </Link>
    </div>
  );
}
