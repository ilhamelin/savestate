'use client';
import { useRouter } from 'next/navigation';
import { MutationForm, ActionButton } from '@/components/ui/form';
import { api } from '@/lib/client-api';
import {
  GAME_STATUSES,
  STATUS_LABELS,
  type Game,
  type UserGame,
  type PlayLog,
  type Review,
} from '@/domain/model';
export function RatingInput({
  value = null,
  required = false,
}: {
  value?: number | null;
  required?: boolean;
}) {
  return (
    <label>
      Puntuación / 10
      <select name="rating" defaultValue={value ?? ''} required={required}>
        <option value="">Sin nota</option>
        {Array.from({ length: 19 }, (_, i) => 1 + i * 0.5).map((n) => (
          <option value={n} key={n}>
            ★ {n.toFixed(1)}
          </option>
        ))}
      </select>
    </label>
  );
}
function formRating(form: FormData) {
  return form.get('rating') ? Number(form.get('rating')) : null;
}
export function LibraryForm({ game, entry }: { game: Game; entry?: UserGame }) {
  return (
    <MutationForm
      label={entry ? 'Actualizar checkpoint' : 'Agregar a biblioteca'}
      submit={async (form) => {
        const value = String(form.get('status'));
        await api('library', {
          action: 'save',
          game_id: game.id,
          status: value,
          rating: formRating(form),
        });
        if (
          value === 'platinum' &&
          entry?.status !== 'platinum' &&
          !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
          try {
            const { default: confetti } = await import('canvas-confetti');
            confetti({
              particleCount: 45,
              spread: 50,
              disableForReducedMotion: true,
              colors: ['#00f0ff', '#00ff66', '#ffb800'],
            });
          } catch {
            /* Visual celebration never affects the saved checkpoint. */
          }
        }
      }}
    >
      <div className="form-row">
        <label>
          Estado
          <select name="status" defaultValue={entry?.status ?? 'backlog'}>
            {GAME_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <RatingInput value={entry?.rating} />
      </div>
    </MutationForm>
  );
}
export function PlayLogForm({ entryId, log }: { entryId: string; log?: PlayLog }) {
  return (
    <MutationForm
      label={log ? 'Actualizar partida' : 'Registrar partida'}
      submit={(form) =>
        api('library', {
          action: 'log',
          id: log?.id,
          user_game_id: entryId,
          platform_played: String(form.get('platform')),
          play_method: String(form.get('method')),
          difficulty: String(form.get('difficulty')),
          hours_played: Number(form.get('hours')),
          start_date: form.get('start'),
          finish_date: form.get('finish'),
          note: String(form.get('note')),
        })
      }
    >
      <div className="form-row">
        <label>
          Plataforma
          <input
            name="platform"
            defaultValue={log?.platform_played}
            required
            maxLength={100}
            placeholder="SNES, PC, PS5…"
          />
        </label>
        <label>
          Método
          <select name="method" defaultValue={log?.play_method ?? 'hardware'}>
            <option value="hardware">Hardware original</option>
            <option value="emulator">Emulador</option>
            <option value="other">Otro</option>
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>
          Horas
          <input
            name="hours"
            type="number"
            min={0}
            max={100000}
            step="0.01"
            defaultValue={log?.hours_played ?? 0}
            required
          />
        </label>
        <label>
          Dificultad
          <input
            name="difficulty"
            defaultValue={log?.difficulty ?? ''}
            maxLength={80}
            placeholder="Normal, difícil…"
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          Inicio
          <input type="date" name="start" defaultValue={log?.start_date ?? ''} />
        </label>
        <label>
          Fin
          <input type="date" name="finish" defaultValue={log?.finish_date ?? ''} />
        </label>
      </div>
      <label>
        Nota de esta partida
        <textarea name="note" defaultValue={log?.note ?? ''} maxLength={2000} />
      </label>
    </MutationForm>
  );
}
export function ReviewForm({
  gameId,
  entry,
  review,
}: {
  gameId: string;
  entry?: UserGame;
  review?: Review;
}) {
  return (
    <MutationForm
      label={review ? 'Actualizar reseña' : 'Publicar reseña'}
      submit={(form) =>
        api('library', {
          action: 'review',
          game_id: gameId,
          rating: formRating(form),
          content: String(form.get('content')),
          has_spoilers: form.get('spoilers') === 'yes',
        })
      }
    >
      <RatingInput value={entry?.rating} required />
      <label>
        Tu reseña · Markdown
        <textarea
          name="content"
          defaultValue={review?.content_markdown ?? ''}
          minLength={1}
          maxLength={10000}
          required
          rows={8}
          placeholder="¿Qué dejó esta aventura en ti? **Negritas**, *cursivas*, listas y citas."
        />
      </label>
      <label>
        ¿Contiene spoilers? · obligatorio
        <select
          name="spoilers"
          required
          defaultValue={review ? (review.has_spoilers ? 'yes' : 'no') : ''}
        >
          <option value="" disabled>
            Elige una opción
          </option>
          <option value="no">No contiene spoilers</option>
          <option value="yes">Sí, ocultar por defecto</option>
        </select>
      </label>
      <p className="muted">
        La nota se sincroniza con tu biblioteca. La privacidad sigue sus ajustes.
      </p>
    </MutationForm>
  );
}
export function FavoritesForm({ entries, games }: { entries: UserGame[]; games: Game[] }) {
  const map = new Map(games.map((game) => [game.id, game]));
  return (
    <MutationForm
      label="Fijar Top 4"
      submit={(form) =>
        api('library', {
          action: 'favorites',
          game_ids: [1, 2, 3, 4].map((n) => String(form.get(`favorite-${n}`))).filter(Boolean),
        })
      }
    >
      <div className="form-row">
        {[1, 2, 3, 4].map((n) => (
          <label key={n}>
            Checkpoint favorito {n}
            <select
              name={`favorite-${n}`}
              defaultValue={entries.find((e) => e.favorite_position === n)?.game_id ?? ''}
            >
              <option value="">Sin fijar</option>
              {entries.map((entry) => (
                <option value={entry.game_id} key={entry.id}>
                  {map.get(entry.game_id)?.title ?? 'Juego'}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </MutationForm>
  );
}
export function DeleteLibrary({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ActionButton
      danger
      action={async () => {
        if (window.confirm('¿Eliminar este juego, sus partidas y su reseña de tu biblioteca?')) {
          await api('library', { action: 'delete', id });
          router.refresh();
        }
      }}
    >
      Eliminar de biblioteca
    </ActionButton>
  );
}
export function DeleteLog({ id }: { id: string }) {
  return (
    <ActionButton
      danger
      action={async () => {
        if (window.confirm('¿Eliminar esta partida?'))
          await api('library', { action: 'delete_log', id });
      }}
    >
      Eliminar partida
    </ActionButton>
  );
}
export function DeleteReview({ id }: { id: string }) {
  return (
    <ActionButton danger action={() => api('library', { action: 'delete_review', id })}>
      Eliminar reseña
    </ActionButton>
  );
}
