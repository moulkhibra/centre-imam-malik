import { requireUser, can } from '@/lib/auth/permissions';
import { createTranslator, getLocaleFromCookies } from '@/lib/i18n';
import { ErrorState, PageHeader } from '@/components/ui';
import { StudentsView } from '@/components/people/StudentsView';
import { getStudent, listLevelOptions, listStudents, localisedName } from '@/lib/people/queries';
import { formatDate } from '@/lib/utils/format';
import { GENDERS, STUDENT_STATUSES } from '@/lib/constants';
import type {
  LevelOptionView,
  PeopleLabels,
  StudentFormValues,
  StudentRowView,
  ValueLabels,
} from '@/components/people/types';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** `YYYY-MM-DD`, the only shape `<input type="date">` accepts back. */
function toDateInput(value: Date | null): string {
  if (!value) return '';
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

/** Students have two name columns rather than `nameFr` / `nameAr`. */
function nameAr(firstNameAr: string | null, lastNameAr: string | null): string {
  return [firstNameAr, lastNameAr].filter(Boolean).join(' ');
}

export default async function StudentsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();

  // The screen is a permission, not a link: a user without it gets no rows and
  // no toolbar whatever the URL says.
  if (!can(user, 'students.view')) {
    const localeForError = await getLocaleFromCookies();
    return <ErrorState title={createTranslator(localeForError)('errors.forbidden')} />;
  }

  const canCreate = can(user, 'students.create');
  const canUpdate = can(user, 'students.update');
  const canDelete = can(user, 'students.delete');

  const [locale, params] = await Promise.all([getLocaleFromCookies(), searchParams]);
  const t = createTranslator(locale);

  const { rows, pagination, query } = await listStudents(user.centerId, params);

  // The level dropdown is also the form's own select, so it is only fetched
  // when somebody can actually open a form.
  const levelOptions: LevelOptionView[] =
    canCreate || canUpdate
      ? (await listLevelOptions(user.centerId)).map((level) => ({
          id: level.id,
          label: localisedName(level, locale),
        }))
      : [];

  // `listStudents` returns a projection for the table. The edit form must post
  // every field the update action writes, so the full rows are resolved for the
  // records actually on screen - and only for a user allowed to edit.
  const editValues: Record<string, StudentFormValues> = {};
  if (canUpdate) {
    const full = await Promise.all(rows.map((row) => getStudent(user.centerId, row.id)));
    full.forEach((student, index) => {
      const row = rows[index];
      if (!student || !row) return;
      editValues[student.id] = {
        code: student.code ?? '',
        firstName: student.firstName,
        lastName: student.lastName,
        firstNameAr: student.firstNameAr ?? '',
        lastNameAr: student.lastNameAr ?? '',
        birthDate: toDateInput(student.birthDate),
        gender: student.gender ?? '',
        cin: student.cin ?? '',
        phone: student.phone ?? '',
        whatsapp: student.whatsapp ?? '',
        email: student.email ?? '',
        address: student.address ?? '',
        city: student.city ?? '',
        school: student.school ?? '',
        levelId: student.levelId ?? '',
        emergencyContactName: student.emergencyContactName ?? '',
        emergencyContactPhone: student.emergencyContactPhone ?? '',
        notes: student.notes ?? '',
        status: student.status,
      };
    });
  }

  const viewRows: StudentRowView[] = rows.map((row) => ({
    id: row.id,
    code: row.code ?? '',
    firstName: row.firstName,
    lastName: row.lastName,
    nameAr: nameAr(row.firstNameAr, row.lastNameAr),
    cin: row.cin ?? '',
    phone: row.phone ?? '',
    city: row.city ?? '',
    status: row.status,
    birthDate: formatDate(row.birthDate),
    levelName: row.level ? localisedName(row.level, locale) : '',
    parentsCount: row._count.parents,
  }));

  const statusLabels = Object.fromEntries(
    STUDENT_STATUSES.map((value) => [value, t(`common.statusValues.${value}`)]),
  ) as ValueLabels;

  const genderLabels = Object.fromEntries(
    GENDERS.map((value) => [value, t(`common.genderValues.${value}`)]),
  ) as ValueLabels;

  const labels: PeopleLabels = {
    title: t('students.title'),
    search: t('common.search'),
    searchPlaceholder: t('common.searchPlaceholder'),
    searchAction: t('common.filter'),
    reset: t('common.reset'),
    all: t('common.all'),
    none: t('common.none'),
    noResults: t('common.noResults'),
    empty: t('students.empty'),
    emptySearch: t('students.emptySearch'),
    subtitle: t('students.subtitle'),
    code: t('students.code'),
    firstName: t('students.firstName'),
    lastName: t('students.lastName'),
    firstNameAr: t('students.firstNameAr'),
    lastNameAr: t('students.lastNameAr'),
    cin: t('students.cin'),
    phone: t('students.phone'),
    city: t('students.city'),
    status: t('students.status'),
    gender: t('students.gender'),
    level: t('students.level'),
    birthDate: t('students.birthDate'),
    linkedParents: t('students.linkedParents'),
    linkedStudents: t('parents.linkedStudents'),
    actions: t('students.actions'),
    new: t('students.new'),
    edit: t('students.edit'),
    delete: t('students.delete'),
    create: t('common.create'),
    save: t('common.save'),
    cancel: t('common.cancel'),
    confirm: t('common.confirm'),
    optional: t('common.optional'),
    whatsapp: t('students.whatsapp'),
    email: t('students.email'),
    address: t('students.address'),
    school: t('students.school'),
    emergencyContact: t('students.emergencyContact'),
    notes: t('students.notes'),
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
  };

  return (
    <>
      <PageHeader title={t('students.title')} description={t('students.subtitle')} />
      <StudentsView
        locale={locale}
        rows={viewRows}
        pagination={pagination}
        query={{ q: query.q, sort: query.sort, dir: query.dir, pageSize: query.pageSize }}
        filters={{
          status: query.filter.status,
          gender: query.filter.gender,
          level: query.filter.level,
        }}
        levelOptions={levelOptions}
        editValues={editValues}
        statusLabels={statusLabels}
        genderLabels={genderLabels}
        labels={labels}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
      />
    </>
  );
}
