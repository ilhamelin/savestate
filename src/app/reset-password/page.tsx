import { AuthForm } from '@/components/auth-form';
import { currentUser } from '@/lib/session';
import { redirect } from 'next/navigation';
export default async function ResetPassword() {
  if (!(await currentUser())) redirect('/login');
  return <AuthForm configured reset />;
}
