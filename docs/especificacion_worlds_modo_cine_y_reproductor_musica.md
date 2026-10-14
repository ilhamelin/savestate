# Especificación Técnica: Modo Cine (Estilo YouTube) y Discografía Completa de Himnos de Worlds (`/worlds`)

## 1. Resumen y Correcciones

Esta actualización resuelve el error de reproducción con LatinAutor / UMPG e incorpora las canciones solicitadas por el usuario:

1. **Corrección de Bloqueo de Contenido en "Heavy Is The Crown" (2024)**:
   - El ID anterior (`5FrhtahQiRc`) pertenecía a la subida en el canal personal de la banda Linkin Park, la cual tiene bloqueada la inserción (*embed*) por reclamos de la editora musical LatinAutor - UMPG.
   - Se sustituye por el video oficial del canal de **League of Legends / Riot Games Music**: **`fJ9rUzIMcZQ`**, el cual cuenta con los derechos oficiales de inserción habilitados para el evento competitivo.

2. **Incorporación de los Himnos 2025 y 2026**:
   - **2026**: *Know My Name* — True Damage (ID oficial: `mlFxxNsExJc`), himno oficial y tributo de regreso con Faker.
   - **2025**: *Sacrifice* — G.E.M. (鄧紫棋) (ID oficial: `pzt6SmvGpXk`), himno melódico conmemorativo de los 15 años de LoL.

3. **Modo Cine (YouTube Cinema Mode)**:
   - Conmutador de 3 modos: `normal` (caja estándar), `cinema` (expansión panorámica a `100vw`) y `theater` (oscurecimiento ambiental).
   - Atajos de teclado: `C` para Cine, `T` para Teatro, `Escape` para normal.

---

## 2. Catálogo Oficial Actualizado de Himnos de Worlds (11 Pistas)

```ts
export const WORLDS_ANTHEMS = [
  { year: 2026, title: 'Know My Name', artist: 'True Damage', id: 'mlFxxNsExJc' },
  { year: 2025, title: 'Sacrifice', artist: 'G.E.M.', id: 'pzt6SmvGpXk' },
  { year: 2024, title: 'Heavy Is The Crown', artist: 'Linkin Park', id: 'fJ9rUzIMcZQ' },
  { year: 2023, title: 'GODS', artist: 'NewJeans', id: 'C3GouGa0noM' },
  { year: 2022, title: "STAR WALKIN'", artist: 'Lil Nas X', id: 'HYsz1hP0BFo' },
  { year: 2021, title: 'Burn It All Down', artist: 'PVRIS', id: '1Z6CHioIn3s' },
  { year: 2020, title: 'Take Over', artist: 'Jeremy McKinnon, MAX, Henry', id: 'KbNL9ZyB49c' },
  { year: 2019, title: 'Phoenix', artist: 'Cailin Russo & Chrissy Costanza', id: 'i1IKnWDecwA' },
  { year: 2018, title: 'RISE', artist: 'The Glitch Mob, Mako, The Word Alive', id: 'fB8TyLTD7EE' },
  { year: 2017, title: 'Legends Never Die', artist: 'Against The Current', id: '4Q46xYqUwZQ' },
  { year: 2014, title: 'Warriors', artist: 'Imagine Dragons', id: 'fmI_Ndrxy14' },
] as const;
```

---

## 3. Pruebas y Validación
- Actualización de `tests/unit/worlds-features.test.ts` para verificar la existencia de los 11 himnos oficiales con sus IDs verificados de 11 caracteres y el orden cronológico descendente.
- Ejecución limpia de `npm run check`.
