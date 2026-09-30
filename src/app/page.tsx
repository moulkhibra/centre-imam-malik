import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  redirect(user.mustChangePassword ? '/account/password' : '/dashboard');
}
