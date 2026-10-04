import { requireUser, can, parsePermissions } from '@/lib/auth/permissions';
import { createTranslator, getLocaleFromCookies } from '@/lib/i18n';
import { ErrorState, PageHeader } from '@/components/ui';
import {
  countActiveAdmins,
  listTeacherAccountOptions,
  listUsers,
} from '@/lib/users/queries';
import { ROLE_LABELS, ROLES, type Permission, type Role } from '@/lib/constants';
import { formatDate } from '@/lib/utils/format';
import { UsersView } from '@/components/admin/UsersView';
import type {
  TeacherOptionView,
  UserFormValues,
  UserRowView,
  UsersViewLabels,
  ValueLabels,
} from '@/components/admin/types';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Accounts screen.
 *
 * `users.view` decides whether the screen exists; `users.manage` decides whether
 * anything can be written. Both are re-checked inside every action, so this page
 * only ever hides what the server would refuse anyway.
 *
 * Two things are resolved here rather than in the Client Component, because they
 * are decisions, not formatting:
 *
 *  - `canDeactivate` per row. The reader's own account and the last active
 *    administrator are marked so the toolbar cannot offer an action that the
 *    server will refuse. The count of active administrators is asked once.
 *  - The effective permissions of every account, through the same
 *    `parsePermissions` the session uses. An ADMIN resolves to the whole
 *    catalogue and is shown as one sentence rather than fifty rows.
 */
export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();

  if (!can(user, 'users.view')) {
    const localeForError = await getLocaleFromCookies();
    return <ErrorState title={createTranslator(localeForError)('errors.forbidden')} />;
  }

  const canManage = can(user, 'users.manage');

  const [locale, params] = await Promise.all([getLocaleFromCookies(), searchParams]);
  const t = createTranslator(locale);

  const centerId = user.centerId;
  const { rows, pagination, query } = await listUsers(centerId, params);

  // One count answers "would deactivating this row leave an administrator?".
  // Two active administrators means every active ADMIN row can be deactivated;
  // one means none of them can.
  const activeAdmins = await countActiveAdmins(centerId);
  const anotherAdminRemains = activeAdmins > 1;

  const teacherRows = canManage ? await listTeacherAccountOptions(centerId) : [];

  const teacherName = (row: {
    firstName: string;
    lastName: string;
    firstNameAr: string | null;
    lastNameAr: string | null;
  }): string => {
    if (locale === 'ar') {
      const arabic = `${row.lastNameAr ?? ''} ${row.firstNameAr ?? ''}`.trim();
      if (arabic) return arabic;
    }
    return `${row.lastName} ${row.firstName}`;
  };

  const viewRows: UserRowView[] = rows.map((row) => {
    const role = row.role as Role;
    const effective = parsePermissions(row.permissions, role);
    return {
      id: row.id,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone ?? '',
      role: row.role,
      isActive: row.isActive,
      mustChangePassword: row.mustChangePassword,
      lastLoginAt: row.lastLoginAt ? formatDate(row.lastLoginAt) : '',
      createdAt: formatDate(row.createdAt),
      teacherLabel: row.teacher ? teacherName(row.teacher) : '',
      teacherCode: row.teacher?.code ?? '',
      isSelf: row.id === user.id,
      // The last active administrator cannot be deactivated, and neither can the
      // reader: both cases are refused by `setUserActiveAction`.
      canDeactivate: row.id !== user.id && (row.role !== 'ADMIN' || anotherAdminRemains),
      // null = the whole catalogue, displayed as a single sentence.
      permissions: role === 'ADMIN' ? null : (effective as Permission[]),
    };
  });

  const editValues: Record<string, UserFormValues> = {};
  if (canManage) {
    for (const row of rows) {
      editValues[row.id] = {
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        phone: row.phone ?? '',
        role: row.role,
        teacherId: row.teacherId ?? '',
        locale: row.locale === 'ar' ? 'ar' : 'fr',
      };
    }
  }

  const teacherOptions: TeacherOptionView[] = teacherRows.map((teacher) => ({
    id: teacher.id,
    label: `${teacherName(teacher)} (${teacher.code})`,
    takenBy: teacher.account ? teacher.account.email : '',
    isCurrent: false,
  }));

  const roleLabels: ValueLabels = Object.fromEntries(
    ROLES.map((role) => [role, ROLE_LABELS[role][locale]]),
  );
  const localeLabels: ValueLabels = {
    fr: t('settings.localeFr'),
    ar: t('settings.localeAr'),
  };

  const labels: UsersViewLabels = {
    search: t('common.search'),
    reset: t('common.reset'),
    all: t('common.all'),
    none: t('common.none'),
    noResults: t('common.noResults'),
    previous: t('common.previous'),
    next: t('common.next'),
    page: t('common.page'),
    of: t('common.of'),
    showing: t('common.showing'),
    create: t('common.create'),
    save: t('common.save'),
    cancel: t('common.cancel'),
    optional: t('common.optional'),
    error: t('common.error'),
    loading: t('common.loading'),
    title: t('users.title'),
    subtitle: t('users.subtitle'),
    name: t('common.name'),
    firstName: t('common.firstName'),
    lastName: t('common.lastName'),
    email: t('common.email'),
    role: t('users.role'),
    status: t('users.status'),
    teacher: t('users.teacher'),
    lastLogin: t('users.lastLogin'),
    actions: t('common.actions'),
    new: t('users.new'),
    edit: t('users.edit'),
    phone: t('common.phone'),
    language: t('users.language'),
    initialPassword: t('users.initialPassword'),
    initialPasswordHint: t('users.initialPasswordHint'),
    resetPassword: t('users.resetPassword'),
    resetPasswordTitle: t('users.resetPasswordTitle'),
    resetPasswordHint: t('users.resetPasswordHint'),
    newPassword: t('users.newPassword'),
    confirmPassword: t('users.confirmPassword'),
    accountActive: t('users.accountActive'),
    accountInactive: t('users.accountInactive'),
    temporaryPassword: t('users.temporaryPassword'),
    neverLoggedIn: t('users.neverLoggedIn'),
    teacherHint: t('users.teacherHint'),
    noTeacher: t('users.noTeacher'),
    noTeachers: t('users.noTeachers'),
    teachersPartlyTaken: t('users.teachersPartlyTaken'),
    permissions: t('users.permissions'),
    rolePermissions: t('users.rolePermissions'),
    extraPermissions: t('users.extraPermissions'),
    noExtraPermissions: t('users.noExtraPermissions'),
    allPermissions: t('users.allPermissions'),
    deactivate: t('users.deactivate'),
    activate: t('users.activate'),
    deactivateConfirm: t('users.deactivateConfirm'),
    deactivateConfirmHint: t('users.deactivateConfirmHint'),
    activateConfirm: t('users.activateConfirm'),
    activateConfirmHint: t('users.activateConfirmHint'),
    confirm: t('common.confirm'),
    created: t('users.created'),
    updated: t('users.updated'),
    deactivated: t('users.deactivated'),
    activated: t('users.activated'),
    passwordResetDone: t('users.passwordResetDone'),
    empty: t('users.empty'),
    emptySearch: t('users.emptySearch'),
  };

  return (
    <>
      <PageHeader title={t('users.title')} description={t('users.subtitle')} />
      <UsersView
        rows={viewRows}
        pagination={pagination}
        query={{ q: query.q, sort: query.sort, dir: query.dir, pageSize: query.pageSize }}
        filters={{ role: query.filter.role, status: query.filter.status, password: query.filter.password }}
        editValues={editValues}
        teacherOptions={teacherOptions}
        roleLabels={roleLabels}
        localeLabels={localeLabels}
        labels={labels}
        canManage={canManage}
      />
    </>
  );
}
