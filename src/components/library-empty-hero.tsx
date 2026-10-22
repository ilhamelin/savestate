import Link from 'next/link';
import { Gamepad2, Zap } from 'lucide-react';

export function LibraryEmptyHero() {
  return (
    <section className="panel library-empty-hero" aria-labelledby="library-empty-heading">
      <div className="library-empty-terminal" aria-hidden="true">
        <Gamepad2 size={44} />
        <span>&gt; memory_card.scan()</span>
        <strong>0 JUEGOS // ESPERANDO CHECKPOINT</strong>
        <span>READY TO SAVE YOUR STORY_</span>
      </div>
      <div>
        <p className="eyebrow">[CHECKPOINT 0: INICIA TU COLECCIÓN]</p>
        <h2 id="library-empty-heading">Tu historia gamer empieza aquí.</h2>
        <p className="muted">
          Trae tu biblioteca de Steam o importa tus juegos de PlayStation y Xbox. Podrás revisar y
          confirmar la selección antes de guardar.
        </p>
        <div className="filter-buttons library-empty-actions">
          <Link className="button library-import-cta" href="/library/import">
            <Zap size={18} aria-hidden="true" /> Importar desde Steam en 1 Clic
          </Link>
          <Link className="button outline" href="/explore">
            Explorar catálogo IGDB →
          </Link>
        </div>
        <small className="muted">También puedes agregar juegos uno a uno desde sus fichas.</small>
      </div>
    </section>
  );
}
