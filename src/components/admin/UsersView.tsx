'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  IconCheck,
  IconEdit,
  IconKey,
  IconLogout,
  IconPlus,
  IconUsers,
  Modal,
  Spinner,
} from '@/components/ui';
import {
  DataTable,
  ListToolbar,
  Pagination,
  type Column,
  type ToolbarFilter,
} from '@/components/list';
import { setUserActiveAction } from '@/actions/users';
import { UserForm, type UserFormValues } from '@/components/admin/UserForm';
import { PasswordResetForm } from '@/components/admin/PasswordResetForm';
import { listHref, type PageInfo, type SortDirection } from '@/lib/lists';
import type { ErrorMessage } from '@/lib/validation/messages';
import type {
  TeacherOptionView,
  UserRowView,
  UsersViewLabels,
  ValueLabels,
} from '@/components/admin/types';

/**
 * Accounts list: toolbar, table, pagination and the four modals.
 *
 * The URL is the only source of truth for what is on screen: this component
 * navigates and lets the Server Component re-render. Its local state is which
 * modal is open and the last outcome message.
 *
 * An account is never deleted here. Deactivation is the operation, because an
 * account owns audit entries, payments it recorded and receipts it issued:
 * removing the row would orphan all of them. It is also reversible, so a
 * mistaken deactivation costs one click.
 *
 * Which buttons exist is decided by the server, per row: `canDeactivate` is
 * false for the reader's own account and for the last active administrator.
 * Hiding them is presentation - `setUserActiveAction` refuses both on the server
 * too - but a refused action the reader could have tried is a defect.
 */

const BASE_PATH = '/admin/users';

/** "Amine Alaoui — admin@centre.tld": what a dialog names the row with. */
function accountLabel(row: UserRowView): string {
  return `${row.lastName} ${row.firstName} — ${row.email}`;
}

type Filters = { role: string; status: string; password: string };

type Target = { id: string; label: string; isActive: boolean } | null;

type Flash = { tone: 'success' | 'danger'; message: string; errorKey?: ErrorMessage; signature: string };

/** Identifies the exact view a confirmation message belongs to. */
function viewSignature(
  query: { q: string; sort: string; dir: SortDirection; pageSize: number },
  pagination: PageInfo,
): string {
  return [query.q, query.sort, query.dir, query.pageSize, pagination.page].join('|');
}

export function UsersView({
  rows,
  pagination,
  query,
  filters,
  editValues,
  teacherOptions,
  roleLabels,
  localeLabels,
  labels,
  canManage,
}: {
  rows: UserRowView[];
  pagination: PageInfo;
  query: { q: string; sort: string; dir: SortDirection; pageSize: number };
  filters: Filters;
  /** Full record per id, resolved server-side; only for users who may edit. */
  editValues: Record<string, UserFormValues>;
  teacherOptions: TeacherOptionView[];
  roleLabels: ValueLabels;
  localeLabels: ValueLabels;
  labels: UsersViewLabels;
  canManage: boolean;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<Target>(null);
  const [toggleTarget, setToggleTarget] = useState<Target>(null);
  const [flash, setFlash] = useState<Flash | null>(null);

  const filterRecord: Record<string, unknown> = { ...filters };
  const isFiltered = Boolean(
    query.q ||
      (filters.role && filters.role !== 'ALL') ||
      (filters.status && filters.status !== 'ALL') ||
      (filters.password && filters.password !== 'ALL'),
  );

  // A confirmation belongs to the view that produced it: deriving visibility from
  // the URL rather than clearing it in an effect keeps "compte créé" from
  // surviving a later navigation onto a different page.
  const signature = viewSignature(query, pagination);
  const visibleFlash = flash && flash.signature === signature ? flash : null;
  const showFlash = (tone: Flash['tone'], message: string, errorKey?: ErrorMessage) =>
    setFlash({ tone, message, errorKey, signature: viewSignature(query, pagination) });

  const refresh = () => router.refresh();

  const toolbarFilters: ToolbarFilter[] = [
    {
      name: 'role',
      label: labels.role,
      value: filters.role || 'ALL',
      options: Object.keys(roleLabels).map((value) => ({ value, label: roleLabels[value] ?? value })),
    },
    {
      name: 'status',
      label: labels.status,
      value: filters.status || 'ALL',
      options: [
        { value: 'ACTIVE', label: labels.accountActive },
        { value: 'INACTIVE', label: labels.accountInactive },
      ],
    },
    {
      name: 'password',
      label: labels.temporaryPassword,
      value: filters.password || 'ALL',
      options: [{ value: 'PENDING', label: labels.temporaryPassword }],
    },
  ];

  const columns: Array<Column<UserRowView>> = [
    {
      key: 'lastName',
      header: labels.name,
      sortKey: 'lastName',
      cell: (row) => (
        <span dir="ltr">
          {row.lastName} {row.firstName}
          {row.isSelf ? <span className="ms-1 text-xs text-ink-500">({row.email})</span> : null}
        </span>
      ),
    },
    {
      key: 'email',
      header: labels.email,
      sortKey: 'email',
      cell: (row) => <span dir="ltr">{row.email}</span>,
    },
    {
      key: 'role',
      header: labels.role,
      sortKey: 'role',
      cell: (row) => (
        <Badge tone={row.role === 'ADMIN' ? 'brand' : 'info'}>{roleLabels[row.role] ?? row.role}</Badge>
      ),
    },
    {
      key: 'teacher',
      header: labels.teacher,
      cell: (row) =>
        row.teacherLabel ? (
          <span>
            {row.teacherLabel} <span className="font-mono text-xs text-ink-500">{row.teacherCode}</span>
          </span>
        ) : (
          <span className="text-ink-400">{labels.noTeacher}</span>
        ),
    },
    {
      key: 'permissions',
      header: labels.permissions,
      cell: (row) =>
        row.permissions === null ? (
          <Badge tone="neutral">{labels.allPermissions}</Badge>
        ) : (
          // The full list stays in the DOM behind a CSS ellipsis, so it is read
          // out in full by a screen reader and only shortened on screen.
          <span className="flex items-center gap-1">
            <Badge tone={row.permissions.length > 0 ? 'info' : 'neutral'}>{row.permissions.length}</Badge>
            <span className="max-w-[14rem] truncate text-xs text-ink-500" title={row.permissions.join(', ')}>
              {row.permissions.length > 0 ? row.permissions.join(', ') : labels.noExtraPermissions}
            </span>
          </span>
        ),
    },
    {
      key: 'status',
      header: labels.status,
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1">
          <Badge tone={row.isActive ? 'success' : 'neutral'}>
            {row.isActive ? labels.accountActive : labels.accountInactive}
          </Badge>
          {row.mustChangePassword ? <Badge tone="warning">{labels.temporaryPassword}</Badge> : null}
        </div>
      ),
    },
    {
      key: 'lastLoginAt',
      header: labels.lastLogin,
      sortKey: 'lastLoginAt',
      className: 'whitespace-nowrap',
      cell: (row) => (
        <span className="tabular-nums">{row.lastLoginAt || labels.neverLoggedIn}</span>
      ),
    },
  ];

  if (canManage) {
    columns.push({
      key: 'actions',
      header: labels.actions,
      headerClassName: 'text-end',
      className: 'text-end whitespace-nowrap',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => setEditingId(row.id)}
            aria-label={`${labels.edit} ${row.email}`}
            title={labels.edit}
          >
            <IconEdit className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => setResetTarget({ id: row.id, label: accountLabel(row), isActive: row.isActive })}
            aria-label={`${labels.resetPassword} ${row.email}`}
            title={labels.resetPassword}
          >
            <IconKey className="size-4" />
          </Button>
          {row.isActive && row.canDeactivate ? (
            <Button
              variant="ghost"
              size="iconSm"
              className="text-danger-600 hover:bg-danger-50"
              onClick={() => setToggleTarget({ id: row.id, label: accountLabel(row), isActive: row.isActive })}
              aria-label={`${labels.deactivate} ${row.email}`}
              title={labels.deactivate}
            >
              <IconLogout className="size-4" />
            </Button>
          ) : null}
          {!row.isActive ? (
            <Button
              variant="ghost"
              size="iconSm"
              onClick={() => setToggleTarget({ id: row.id, label: accountLabel(row), isActive: row.isActive })}
              aria-label={`${labels.activate} ${row.email}`}
              title={labels.activate}
            >
              <IconCheck className="size-4" />
            </Button>
          ) : null}
        </div>
      ),
    });
  }

  const editingRow = editingId ? rows.find((row) => row.id === editingId) : undefined;
  const editingValues = editingId ? editValues[editingId] : undefined;

  const emptyState = isFiltered ? (
    <EmptyState
      title={labels.emptySearch}
      description={labels.noResults}
      icon={<IconUsers className="size-8" />}
      action={
        <Button variant="secondary" onClick={() => router.push(listHref(BASE_PATH))}>
          {labels.reset}
        </Button>
      }
    />
  ) : (
    <EmptyState title={labels.empty} description={labels.subtitle} icon={<IconUsers className="size-8" />} />
  );

  return (
    <div className="space-y-3">
      <ListToolbar
        basePath={BASE_PATH}
        q={query.q}
        query={{ ...query, filter: filterRecord }}
        filters={toolbarFilters}
        searchLabel={labels.search}
        searchPlaceholder={labels.searchPlaceholder}
        searchAction={labels.searchAction}
        resetLabel={labels.reset}
      >
        {canManage ? (
          <Button onClick={() => setCreateOpen(true)}>
            <IconPlus className="size-4" />
            {labels.new}
          </Button>
        ) : null}
      </ListToolbar>

      {visibleFlash ? (
        <Alert tone={visibleFlash.tone} errorKey={visibleFlash.errorKey}>
          {visibleFlash.message}
        </Alert>
      ) : null}

      <DataTable<UserRowView>
        basePath={BASE_PATH}
        columns={columns}
        rows={rows}
        current={{ sort: query.sort, dir: query.dir, pageSize: query.pageSize }}
        q={query.q}
        filter={filterRecord}
        caption={labels.title}
        emptyState={emptyState}
      />

      <Pagination
        basePath={BASE_PATH}
        pagination={pagination}
        current={{ sort: query.sort, dir: query.dir, pageSize: query.pageSize }}
        q={query.q}
        filter={filterRecord}
        labels={{
          previous: labels.previous,
          next: labels.next,
          page: labels.page,
          of: labels.of,
          showing: labels.showing,
        }}
      />

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={labels.new}
        description={labels.subtitle}
        size="lg"
      >
        <UserForm
          key="user-create"
          recordId={null}
          values={createValues}
          roleLabels={roleLabels}
          localeLabels={localeLabels}
          teacherOptions={teacherOptions}
          labels={labels}
          onCancel={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            showFlash('success', labels.created);
            refresh();
          }}
        />
      </Modal>

      {editingRow && editingValues ? (
        <Modal open onClose={() => setEditingId(null)} title={`${labels.edit} · ${editingRow.email}`} size="lg">
          <UserForm
            key={editingRow.id}
            recordId={editingRow.id}
            values={editingValues}
            roleLabels={roleLabels}
            localeLabels={localeLabels}
            teacherOptions={teacherOptions}
            labels={labels}
            onCancel={() => setEditingId(null)}
            onSaved={() => {
              setEditingId(null);
              showFlash('success', labels.updated);
              refresh();
            }}
          />
        </Modal>
      ) : null}

      {resetTarget ? (
        <Modal
          open
          onClose={() => setResetTarget(null)}
          title={labels.resetPasswordTitle}
          description={labels.resetPassword}
          size="sm"
        >
          <PasswordResetForm
            key={resetTarget.id}
            recordId={resetTarget.id}
            targetLabel={resetTarget.label}
            labels={labels}
            onCancel={() => setResetTarget(null)}
            onSaved={() => {
              setResetTarget(null);
              showFlash('success', labels.passwordResetDone);
              refresh();
            }}
          />
        </Modal>
      ) : null}

      {toggleTarget ? (
        <ToggleActiveDialog
          key={toggleTarget.id}
          target={toggleTarget}
          labels={labels}
          onClose={() => setToggleTarget(null)}
          onDone={(nowActive) => {
            setToggleTarget(null);
            showFlash('success', nowActive ? labels.activated : labels.deactivated);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

const createValues = {
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  role: 'SECRETARY',
  teacherId: '',
  locale: 'fr',
  password: '',
} satisfies UserFormValues & { password: string };

/**
 * Deactivation / reactivation.
 *
 * The wording states what is kept and what is lost, because "désactiver" reads
 * like "delete" to a first-time user and the difference here is that the audit
 * trail and the data the account created survive.
 */
function ToggleActiveDialog({
  target,
  labels,
  onClose,
  onDone,
}: {
  target: { id: string; label: string; isActive: boolean };
  labels: UsersViewLabels;
  onClose: () => void;
  onDone: (nowActive: boolean) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; errorKey?: ErrorMessage } | undefined>(undefined);

  const submit = async () => {
    setPending(true);
    setError(undefined);
    try {
      const result = await setUserActiveAction(target.id, willActivate);
      if (result.ok) {
        onDone(willActivate);
        return;
      }
      // The guards answer with a banner (last administrator, own account): both
      // are decisions about the whole account, not about one field.
      setError({ message: result.error, errorKey: result.errorKey });
    } catch {
      setError({ message: labels.error });
    } finally {
      setPending(false);
    }
  };

  // The row the dialog was opened from disappears under an `ACTIVE` filter once
  // deactivated, so the state being left travels with the target rather than
  // being read back from the list.
  const willActivate = !target.isActive;

  return (
    <Modal
      open
      onClose={onClose}
      title={willActivate ? labels.activateConfirm : labels.deactivateConfirm}
      description={willActivate ? labels.activateConfirmHint : labels.deactivateConfirmHint}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {labels.cancel}
          </Button>
          <Button
            variant={willActivate ? 'primary' : 'danger'}
            onClick={() => void submit()}
            disabled={pending}
          >
            {pending ? <Spinner /> : null}
            {labels.confirm}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? (
          <Alert tone="danger" errorKey={error.errorKey}>
            {error.message}
          </Alert>
        ) : null}
        <p className="text-sm text-ink-700">{target.label}</p>
      </div>
    </Modal>
  );
}