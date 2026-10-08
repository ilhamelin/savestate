'use client';
import { MutationForm, ActionButton } from '@/components/ui/form';
import { api } from '@/lib/client-api';
import { useRouter } from 'next/navigation';
import type { UserList, Game, ListItem } from '@/domain/model';
import { CataloguePicker } from '@/components/catalogue-picker';
import { useState } from 'react';
import { LIST_TEMPLATES } from '@/domain/list-personality';
export function ListForm({ list }: { list?: UserList }) {
  const router = useRouter();
  const [title, setTitle] = useState(list?.title ?? '');
  const [description, setDescription] = useState(list?.description ?? '');
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
      {!list ? (
        <div className="list-templates" role="group" aria-label="Plantillas de listas">
          <p className="muted">Una idea para empezar. Puedes cambiar el título y la descripción.</p>
          {LIST_TEMPLATES.map((template) => (
            <button
              key={template.title}
              type="button"
              className="studio-chip"
              onClick={() => {
                setTitle(template.title);
                setDescription(template.description);
              }}
            >
              {template.title}
            </button>
          ))}
        </div>
      ) : null}
      <label>
        Título
        <input
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={120}
        />
      </label>
      <label>
        Descripción
        <textarea
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={2000}
        />
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
        {item ? (
          <label>
            Juego
            <input
              readOnly
              value={games.find((game) => game.id === item.game_id)?.title ?? 'Juego de la lista'}
            />
            <input type="hidden" name="game" value={item.game_id} />
          </label>
        ) : (
          <CataloguePicker games={games} />
        )}
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
        Nota del autor
        <textarea
          name="note"
          maxLength={1000}
          rows={4}
          defaultValue={item?.note ?? ''}
          placeholder="¿Por qué elegiste este juego? Hasta 1000 caracteres."
        />
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
