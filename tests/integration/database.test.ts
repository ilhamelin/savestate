import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test(
  'PostgreSQL: RLS, amistad, puntuación atómica, Top 4 y múltiples partidas',
  { skip: !process.env.TEST_DATABASE_URL },
  () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
      throw new Error('Por seguridad, este runner requiere PostgreSQL local de pruebas.');
    execFileSync(
      'psql',
      [
        url.toString(),
        '-X',
        '-v',
        'ON_ERROR_STOP=1',
        '-f',
        fileURLToPath(new URL('./rls.sql', import.meta.url)),
      ],
      { stdio: 'pipe' },
    );
  },
);
