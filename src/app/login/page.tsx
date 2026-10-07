import { AuthForm } from '@/components/auth-form';
import { SetupNotice } from '@/components/setup-notice';
import { isConfigured } from '@/lib/env';
export const metadata = { title: 'Conectar' };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <>
      <SetupNotice />
      {error ? (
        <p role="alert" className="notice">
          El enlace de acceso no se pudo validar. Vuelve a iniciar sesión o solicita un nuevo
          enlace.
        </p>
      ) : null}
      <AuthForm configured={isConfigured()} />
    </>
  );
}
