'use client';
import { MutationForm, ActionButton } from '@/components/ui/form';
import { api } from '@/lib/client-api';
import { useRouter } from 'next/navigation';
import type { UserList, Game, ListItem } from '@/domain/model';
export function ListForm({ list }: { list?: UserList }) {
  const router = useRouter();
  return (
    <MutationForm
      label={list ? 'Guardar lista' : 'Crear lista'}
      submit={async (form) => {
        const saved = await api<UserList>('lists', {
          action: 'save',
          id: list?.id,
          title: String(form.get('title')),
          description: String(form.get('description')),
          is_private: form.get('private') === 'on',
        });
        if (!list) router.push(`/lists/${saved.id}`);
      }}
    >
      <label>
        Título
        <input name="title" defaultValue={list?.title} required maxLength={120} />
      </label>
      <label>
        Descripción
        <textarea name="description" defaultValue={list?.description ?? ''} maxLength={2000} />
      </label>
      <label className="checkbox-label">
        <input name="private" type="checkbox" defaultChecked={list?.is_private} />
        Lista privada, visible solo para mí
      </label>
    </MutationForm>
  );
}
export function ListItemForm({
  listId,
  games,
  nextPosition,
  item,
}: {
  listId: string;
  games: Game[];
  nextPosition: number;
  item?: ListItem;
}) {
  return (
    <MutationForm
      label={item ? 'Actualizar elemento' : 'Agregar juego'}
      submit={(form) =>
        api('lists', {
          action: 'item',
          list_id: listId,
          game_id: String(form.get('game')),
          position_index: Number(form.get('position')),
          note: String(form.get('note')),
        })
      }
    >
      <div className="form-row">
        <label>
          Juego de mi biblioteca
          <select name="game" required defaultValue={item?.game_id ?? ''}>
            <option value="" disabled>
              Selecciona un juego
            </option>
            {games.map((game) => (
              <option value={game.id} key={game.id}>
                {game.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Posición (desde 0)
          <input
            name="position"
            type="number"
            min={0}
            max={10000}
            defaultValue={item?.position_index ?? nextPosition}
            required
          />
        </label>
      </div>
      <label>
        Nota
        <input name="note" maxLength={1000} defaultValue={item?.note ?? ''} />
      </label>
    </MutationForm>
  );
}
export function RemoveListItem({ id }: { id: string }) {
  return (
    <ActionButton danger action={() => api('lists', { action: 'remove_item', id })}>
      Quitar juego
    </ActionButton>
  );
}
export function DeleteList({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ActionButton
      danger
      action={async () => {
        if (!window.confirm('¿Eliminar esta lista?')) return;
        await api('lists', { action: 'delete', id });
        router.push('/lists');
      }}
    >
      Eliminar lista
    </ActionButton>
  );
}
