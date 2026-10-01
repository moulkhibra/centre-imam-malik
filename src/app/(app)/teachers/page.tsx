import { requireUser, can } from '@/lib/auth/permissions';
import { createTranslator, getLocaleFromCookies } from '@/lib/i18n';
import { ErrorState, PageHeader } from '@/components/ui';
import { TeachersView, type TeacherRowView } from '@/components/people/TeachersView';
import type { TeacherFormValues, TeacherLabels } from '@/components/people/TeacherForm';
import { getTeacher, listTeachers } from '@/lib/people/queries';
import { STUDENT_STATUSES } from '@/lib/constants';
import type { ValueLabels } from '@/components/people/types';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** `YYYY-MM-DD`, the only shape `<input type="date">` accepts back. */
function toDateInput(value: Date | null): string {
  if (!value) return '';
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

/** Teachers have two name columns rather than `nameFr` / `nameAr`. */
function nameAr(firstNameAr: string | null, lastNameAr: string | null): string {
  return [firstNameAr, lastNameAr].filter(Boolean).join(' ');
}

export default async function TeachersPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();

  // The screen is a permission, not a link: a user without it gets no rows and
  // no toolbar whatever the URL says.
  if (!can(user, 'teachers.view')) {
    const localeForError = await getLocaleFromCookies();
    return <ErrorState title={createTranslator(localeForError)('errors.forbidden')} />;
  }

  const canCreate = can(user, 'teachers.create');
  const canUpdate = can(user, 'teachers.update');
  const canDelete = can(user, 'teachers.delete');

  const [locale, params] = await Promise.all([getLocaleFromCookies(), searchParams]);
  const t = createTranslator(locale);

  const { rows, pagination, query } = await listTeachers(user.centerId, params);

  // `listTeachers` returns a projection for the table. The update action writes
  // every field, so the full rows are resolved for the records actually on
  // screen - and only for a user allowed to edit.
  const editValues: Record<string, TeacherFormValues> = {};
  if (canUpdate) {
    const full = await Promise.all(rows.map((row) => getTeacher(user.centerId, row.id)));
    full.forEach((teacher, index) => {
      const row = rows[index];
      if (!teacher || !row) return;
      editValues[teacher.id] = {
        code: teacher.code ?? '',
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        firstNameAr: teacher.firstNameAr ?? '',
        lastNameAr: teacher.lastNameAr ?? '',
        phone: teacher.phone ?? '',
        whatsapp: teacher.whatsapp ?? '',
        email: teacher.email ?? '',
        cin: teacher.cin ?? '',
        specialization: teacher.specialization ?? '',
        bio: teacher.bio ?? '',
        hiredAt: toDateInput(teacher.hiredAt),
        status: teacher.status,
        notes: teacher.notes ?? '',
      };
    });
  }

  const viewRows: TeacherRowView[] = rows.map((row) => ({
    id: row.id,
    code: row.code ?? '',
    firstName: row.firstName,
    lastName: row.lastName,
    nameAr: nameAr(row.firstNameAr, row.lastNameAr),
    phone: row.phone ?? '',
    specialization: row.specialization ?? '',
    status: row.status,
    groupsCount: row._count.groups,
    subjectsCount: row._count.subjects,
  }));

  // Teachers share the student status vocabulary, so the same labels drive the
  // toolbar filter, the badge legend and the form's select.
  const statusLabels = Object.fromEntries(
    STUDENT_STATUSES.map((value) => [value, t(`common.statusValues.${value}`)]),
  ) as ValueLabels;

  const labels: TeacherLabels = {
    title: t('teachers.title'),
    search: t('common.search'),
    reset: t('common.reset'),
    noResults: t('common.noResults'),
    empty: t('teachers.empty'),
    emptySearch: t('teachers.emptySearch'),
    subtitle: t('teachers.subtitle'),
    code: t('teachers.code'),
    firstName: t('teachers.firstName'),
    lastName: t('teachers.lastName'),
    firstNameAr: t('teachers.firstNameAr'),
    lastNameAr: t('teachers.lastNameAr'),
    // No `teachers.cin` / `teachers.whatsapp` key exists yet: the same wording
    // is reused from `student.*` rather than showing a raw key as a label.
    cin: t('student.cin'),
    phone: t('common.phone'),
    whatsapp: t('student.whatsapp'),
    email: t('common.email'),
    status: t('teachers.status'),
    actions: t('teachers.actions'),
    new: t('teachers.new'),
    edit: t('teachers.edit'),
    delete: t('teachers.delete'),
    create: t('common.create'),
    save: t('common.save'),
    cancel: t('common.cancel'),
    confirm: t('common.confirm'),
    optional: t('common.optional'),
    notes: t('common.notes'),
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
    specialization: t('teachers.specialization'),
    bio: t('teachers.bio'),
    hiredAt: t('teachers.hiredAt'),
    linkedGroups: t('teachers.linkedGroups'),
    linkedSubjects: t('teachers.linkedSubjects'),
  };

  return (
    <>
      <PageHeader title={t('teachers.title')} description={t('teachers.subtitle')} />
      <TeachersView
        locale={locale}
        rows={viewRows}
        pagination={pagination}
        query={{ q: query.q, sort: query.sort, dir: query.dir, pageSize: query.pageSize }}
        filters={{ status: query.filter.status }}
        editValues={editValues}
        statusLabels={statusLabels}
        labels={labels}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
      />
    </>
  );
}
