import Link from 'next/link';
import Image from 'next/image';
export default function NotFound() {
  return (
    <div className="empty-state halloween-not-found">
      <Image
        src="/icons/halloween/fantasma.png"
        alt=""
        width={80}
        height={80}
        className="halloween-ghost-float"
        unoptimized
      />
      <p className="eyebrow text-halloween-orange">ERROR 404 // CHECKPOINT PERDIDO</p>
      <h1>Partida devorada por las sombras.</h1>
      <p className="muted">
        El save state que buscas se perdió en la niebla espectral o nunca existió.
      </p>
      <Link href="/explore" className="button">
        <Image src="/icons/halloween/calabaza.png" alt="" width={16} height={16} unoptimized />
        Huir al catálogo seguro
      </Link>
    </div>
  );
}
