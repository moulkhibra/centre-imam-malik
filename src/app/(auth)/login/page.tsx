import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/permissions';
import { getActiveCenter } from '@/lib/settings/center';
import { getLocaleFromCookies, createTranslator, isRtl } from '@/lib/i18n';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.mustChangePassword ? '/account/password' : '/dashboard');
  }

  const [center, locale] = await Promise.all([getActiveCenter(), getLocaleFromCookies()]);
  const t = createTranslator(locale);
  const rtl = isRtl(locale);

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          {center?.logoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={center.logoPath} alt={center.nameFr} className="h-16 w-16 rounded-xl object-contain" />
          ) : (
            <div
              className="flex h-16 w-16 items-center justify-center rounded-xl text-2xl font-bold text-white"
              style={{ backgroundColor: center?.primaryColor ?? '#0F766E' }}
              aria-hidden="true"
            >
              IM
            </div>
          )}
          <div>
            <h1 className="text-lg font-semibold text-ink-900" dir={rtl ? 'rtl' : 'ltr'}>
              {rtl ? (center?.nameAr ?? center?.nameFr) : (center?.nameFr ?? center?.nameAr)}
            </h1>
            <p className="mt-1 text-sm text-ink-500">{t('auth.login')}</p>
          </div>
        </div>

        <div className="card p-6">
          <LoginForm
            labels={{
              email: t('auth.email'),
              password: t('auth.password'),
              signIn: t('auth.signIn'),
              signingIn: t('auth.signingIn'),
            }}
          />
        </div>

        <p className="mt-6 text-center text-xs text-ink-500">
          {center?.phone ? (
            <>
              {t('common.phone')} : <span dir="ltr">{center.phone}</span>
            </>
          ) : null}
        </p>
      </div>
    </main>
  );
}
