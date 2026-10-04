import { requireUser, can } from '@/lib/auth/permissions';
import { createTranslator, getLocaleFromCookies } from '@/lib/i18n';
import { ErrorState, PageHeader } from '@/components/ui';
import { getCenterSettingsFormValues } from '@/lib/settings/center';
import { CenterSettingsForm } from '@/components/settings/CenterSettingsForm';
import type { SettingsViewLabels } from '@/components/settings/types';

export const dynamic = 'force-dynamic';

/**
 * Centre settings.
 *
 * `settings.view` opens the screen and `settings.manage` decides whether the
 * fields are editable. A reader with only `settings.view` sees the configured
 * values with the inputs disabled and a note explaining why - hiding the screen
 * entirely would leave them unable to check what is printed on the documents.
 *
 * The values come from `user.centerId` and nowhere else: `getActiveCenter` picks
 * the first centre flagged active, which is a display shortcut and not an
 * authorisation decision.
 */
export default async function SettingsPage() {
  const user = await requireUser();

  if (!can(user, 'settings.view')) {
    const locale = await getLocaleFromCookies();
    return <ErrorState title={createTranslator(locale)('errors.forbidden')} />;
  }

  const [locale, values] = await Promise.all([
    getLocaleFromCookies(),
    getCenterSettingsFormValues(user.centerId),
  ]);
  const t = createTranslator(locale);

  if (!values) {
    return <ErrorState title={t('errors.centerNotFound')} description={t('errors.serverError')} />;
  }

  const canManage = can(user, 'settings.manage');

  const labels: SettingsViewLabels = {
    save: t('common.save'),
    cancel: t('common.cancel'),
    error: t('common.error'),
    loading: t('common.loading'),
    optional: t('common.optional'),
    logoPreviewAlt: t('settings.logo'),
    colors: {
      primary: t('settings.primaryColor'),
      secondary: t('settings.secondaryColor'),
    },
    sections: {
      identity: { id: 'identity', title: t('settings.identity'), hint: t('settings.identityHint') },
      contact: { id: 'contact', title: t('settings.contact') },
      appearance: { id: 'appearance', title: t('settings.appearance'), hint: t('settings.appearanceHint') },
      documents: { id: 'documents', title: t('settings.documents') },
    },
    fields: {
      code: t('settings.code'),
      nameFr: t('settings.nameFr'),
      nameAr: t('settings.nameAr'),
      shortNameFr: t('settings.shortNameFr'),
      shortNameAr: t('settings.shortNameAr'),
      legalName: t('settings.legalName'),
      address: t('settings.address'),
      city: t('settings.city'),
      phone: t('settings.phone'),
      whatsapp: t('settings.whatsapp'),
      email: t('settings.email'),
      facebook: t('settings.facebook'),
      instagram: t('settings.instagram'),
      website: t('settings.website'),
      logoPath: t('settings.logoPath'),
      logoPathHint: t('settings.logoPathHint'),
      timezone: t('settings.timezone'),
      locale: t('settings.defaultLanguage'),
      primaryColor: t('settings.primaryColor'),
      secondaryColor: t('settings.secondaryColor'),
      receiptFooterFr: t('settings.receiptFooterFr'),
      receiptFooterAr: t('settings.receiptFooterAr'),
      certificateFooterFr: t('settings.certificateFooterFr'),
      certificateFooterAr: t('settings.certificateFooterAr'),
      directorNameFr: t('settings.directorNameFr'),
      directorNameAr: t('settings.directorNameAr'),
    },
    localeLabels: {
      fr: t('settings.localeFr'),
      ar: t('settings.localeAr'),
    },
    saved: t('settings.saved'),
    readOnly: t('settings.readOnly'),
  };

  return (
    <>
      <PageHeader title={t('settings.title')} description={t('settings.subtitle')} />
      <CenterSettingsForm values={values} labels={labels} sections={labels.sections} canManage={canManage} />
    </>
  );
}