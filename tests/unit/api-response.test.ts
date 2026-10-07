import test from 'node:test';
import assert from 'node:assert/strict';
import { readJsonResponse } from '../../src/lib/api-response.ts';

test('API: errores vacíos o HTML muestran un mensaje útil sin filtrar el fallo de JSON', async () => {
  for (const body of ['', '<html>Internal server error</html>'])
    await assert.rejects(
      readJsonResponse(new Response(body, { status: 500 })),
      /El servidor no pudo completar la solicitud \(500\)/,
    );
});

test('API: conserva errores JSON de validación y datos de respuestas correctas', async () => {
  await assert.rejects(
    readJsonResponse(Response.json({ error: 'Nombre de usuario ocupado.' }, { status: 409 })),
    /Nombre de usuario ocupado/,
  );
  assert.deepEqual(await readJsonResponse(Response.json({ data: { saved: true } })), {
    data: { saved: true },
  });
  await assert.rejects(readJsonResponse(new Response('', { status: 200 })), /respuesta no válida/);
});
