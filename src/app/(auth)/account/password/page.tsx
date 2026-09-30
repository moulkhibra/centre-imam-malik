import { requireUser } from '@/lib/auth/permissions';
import { createTranslator, getLocaleFromCookies } from '@/lib/i18n';
import { getActiveCenter } from '@/lib/settings/center';
import { logoutAction } from '@/actions/auth';
import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm';
import { initials } from '@/lib/utils/format';
import { ROLE_LABELS, type Role } from '@/lib/constants';
import { IconLogout, IconShield } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function PasswordPage() {
  const user = await requireUser();
  const [locale, center] = await Promise.all([getLocaleFromCookies(), getActiveCenter()]);
  const t = createTranslator(locale);

  const roleLabel = ROLE_LABELS[user.role as Role];

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
            {initials(user.firstName, user.lastName)}
          </div>
          <p className="text-sm text-ink-500">
            {user.firstName} {user.lastName} · {roleLabel[locale]}
          </p>
        </div>

        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <IconShield className="size-5 text-brand-600" />
            <h1 className="text-base font-semibold text-ink-900">{t('auth.changePassword')}</h1>
          </div>

          <ChangePasswordForm
            description={t('auth.mustChangePassword')}
            requirements={t('auth.passwordRequirements')}
            submitLabel={t('auth.changePassword')}
            forced={user.mustChangePassword}
          />
        </div>

        <div className="mt-4 text-center">
          {user.mustChangePassword ? null : (
            <a href="/dashboard" className="text-sm text-brand-700 hover:underline">
              {t('nav.dashboard')}
            </a>
          )}
        </div>

        <form action={logoutAction} className="mt-4 flex justify-center">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
          >
            <IconLogout className="size-4" />
            {t('common.logout')}
          </button>
        </form>

        {center ? <p className="mt-6 text-center text-xs text-ink-500">{center.nameFr}</p> : null}
      </div>
    </main>
  );
}
