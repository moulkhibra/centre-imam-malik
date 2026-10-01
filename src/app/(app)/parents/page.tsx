import { requireUser, can } from '@/lib/auth/permissions';
import { createTranslator, getLocaleFromCookies } from '@/lib/i18n';
import { ErrorState, PageHeader } from '@/components/ui';
import { ParentsView } from '@/components/people/ParentsView';
import { getParent, listParents } from '@/lib/people/queries';
import type { ParentFormValues, ParentRowView, PeopleLabels } from '@/components/people/types';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ParentsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();

  if (!can(user, 'parents.view')) {
    const localeForError = await getLocaleFromCookies();
    return <ErrorState title={createTranslator(localeForError)('errors.forbidden')} />;
  }

  const canCreate = can(user, 'parents.create');
  const canUpdate = can(user, 'parents.update');
  const canDelete = can(user, 'parents.delete');

  const [locale, params] = await Promise.all([getLocaleFromCookies(), searchParams]);
  const t = createTranslator(locale);

  const { rows, pagination, query } = await listParents(user.centerId, params);

  // The list query projects only the columns on screen; the update action writes
  // every field, so the full rows are resolved for whoever may edit.
  const editValues: Record<string, ParentFormValues> = {};
  if (canUpdate) {
    const full = await Promise.all(rows.map((row) => getParent(user.centerId, row.id)));
    full.forEach((parent, index) => {
      const row = rows[index];
      if (!parent || !row) return;
      editValues[parent.id] = {
        code: parent.code ?? '',
        firstName: parent.firstName,
        lastName: parent.lastName,
        cin: parent.cin ?? '',
        phone: parent.phone ?? '',
        whatsapp: parent.whatsapp ?? '',
        email: parent.email ?? '',
        address: parent.address ?? '',
        city: parent.city ?? '',
        relation: parent.relation ?? '',
        notes: parent.notes ?? '',
      };
    });
  }

  const viewRows: ParentRowView[] = rows.map((row) => ({
    id: row.id,
    code: row.code ?? '',
    firstName: row.firstName,
    lastName: row.lastName,
    cin: row.cin ?? '',
    phone: row.phone ?? '',
    city: row.city ?? '',
    studentsCount: row._count.students,
  }));

  const labels: PeopleLabels = {
    title: t('parents.title'),
    search: t('common.search'),
    reset: t('common.reset'),
    all: t('common.all'),
    noResults: t('common.noResults'),
    empty: t('parents.empty'),
    emptySearch: t('parents.emptySearch'),
    subtitle: t('parents.subtitle'),
    code: t('parents.code'),
    firstName: t('parents.firstName'),
    lastName: t('parents.lastName'),
    firstNameAr: t('students.firstNameAr'),
    lastNameAr: t('students.lastNameAr'),
    cin: t('parents.cin'),
    phone: t('parents.phone'),
    city: t('parents.city'),
    status: t('common.status'),
    gender: t('common.gender'),
    level: t('students.level'),
    birthDate: t('students.birthDate'),
    linkedParents: t('students.linkedParents'),
    linkedStudents: t('parents.linkedStudents'),
    actions: t('parents.actions'),
    new: t('parents.new'),
    edit: t('parents.edit'),
    delete: t('parents.delete'),
    create: t('common.create'),
    save: t('common.save'),
    cancel: t('common.cancel'),
    close: t('common.close'),
    confirm: t('common.confirm'),
    required: t('common.required'),
    optional: t('common.optional'),
    whatsapp: t('parents.whatsapp'),
    email: t('parents.email'),
    address: t('parents.address'),
    school: t('students.school'),
    emergencyContact: t('students.emergencyContact'),
    notes: t('parents.notes'),
    relation: t('parents.relation'),
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
    to: t('common.to'),
  };

  return (
    <>
      <PageHeader title={t('parents.title')} description={t('parents.subtitle')} />
      <ParentsView
        rows={viewRows}
        pagination={pagination}
        query={{ q: query.q, sort: query.sort, dir: query.dir, pageSize: query.pageSize }}
        editValues={editValues}
        labels={labels}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
      />
    </>
  );
}
