import { requireUser, can } from '@/lib/auth/permissions';
import { createTranslator, getLocaleFromCookies } from '@/lib/i18n';
import { ErrorState, PageHeader } from '@/components/ui';
import { ServicesView } from '@/components/catalog/ServicesView';
import { getService, listServices } from '@/lib/catalog/queries';
import { centsToMad, formatMad } from '@/lib/utils/format';
import type { ServiceFormValues, ServiceLabels, ServiceRowView } from '@/components/catalog/types';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ServicesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();

  // The screen is a permission, not a link: a user without it gets no rows and
  // no toolbar whatever the URL says.
  if (!can(user, 'academics.view')) {
    const localeForError = await getLocaleFromCookies();
    return <ErrorState title={createTranslator(localeForError)('errors.forbidden')} />;
  }

  // Same permission as the academic structure: a secretary reads the catalogue
  // to answer the phone but does not rewrite the price list.
  const canManage = can(user, 'academics.manage');

  const [locale, params] = await Promise.all([getLocaleFromCookies(), searchParams]);
  const t = createTranslator(locale);

  const { rows, pagination, query } = await listServices(user.centerId, params);

  // The table shows a projection; the edit form must post every field the
  // update action writes, and the price is given back to the user as the
  // decimal they typed - the conversion happens once, on submit.
  const editValues: Record<string, ServiceFormValues> = {};
  if (canManage) {
    const full = await Promise.all(rows.map((row) => getService(user.centerId, row.id)));
    full.forEach((service, index) => {
      const row = rows[index];
      if (!service || !row) return;
      editValues[service.id] = {
        code: service.code,
        nameFr: service.nameFr,
        nameAr: service.nameAr ?? '',
        description: service.description ?? '',
        price: centsToMad(service.defaultPriceCents).toFixed(2),
        durationMinutes: String(service.defaultDurationMinutes),
        active: service.active ? 'true' : '',
      };
    });
  }

  const viewRows: ServiceRowView[] = rows.map((row) => ({
    id: row.id,
    code: row.code,
    nameFr: row.nameFr,
    nameAr: row.nameAr ?? '',
    // Formatting money through the shared helper, never `.toLocaleString()`.
    price: formatMad(row.defaultPriceCents, locale),
    durationMinutes: row.defaultDurationMinutes,
    active: row.active,
  }));

  const labels: ServiceLabels = {
    title: t('nav.services'),
    code: t('service.code'),
    nameFr: t('service.nameFr'),
    nameAr: t('service.nameAr'),
    description: t('service.description'),
    price: t('service.price'),
    duration: t('service.duration'),
    serviceActive: t('service.active'),
    // Shared chrome.
    search: t('common.search'),
    reset: t('common.reset'),
    all: t('common.all'),
    noResults: t('common.noResults'),
    noData: t('common.noData'),
    status: t('common.status'),
    actions: t('common.actions'),
    edit: t('common.edit'),
    delete: t('common.delete'),
    restore: t('common.restore'),
    newService: t('service.newService'),
    create: t('common.create'),
    save: t('common.save'),
    cancel: t('common.cancel'),
    confirm: t('common.confirm'),
    optional: t('common.optional'),
    active: t('common.active'),
    inactive: t('common.inactive'),
    deactivated: t('common.deactivated'),
    deleteConfirm: t('common.deleteConfirm'),
    deleteConfirmHint: t('common.deleteConfirmHint'),
    created: t('common.created'),
    updated: t('common.updated'),
    deleted: t('common.deleted'),
    error: t('common.error'),
    loading: t('common.loading'),
    previous: t('common.previous'),
    next: t('common.next'),
    page: t('common.page'),
    of: t('common.of'),
    showing: t('common.showing'),
  };

  return (
    <>
      <PageHeader title={t('nav.services')} />
      <ServicesView
        rows={viewRows}
        pagination={pagination}
        query={{ q: query.q, sort: query.sort, dir: query.dir, pageSize: query.pageSize }}
        filters={{ active: query.filter.active, stage: query.filter.stage }}
        editValues={editValues}
        labels={labels}
        canManage={canManage}
      />
    </>
  );
}