'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  IconBook,
  IconEdit,
  IconLayers,
  IconPlus,
  IconTeacher,
  IconTrash,
  Input,
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
import { deleteTeacherAction } from '@/actions/teachers';
import { TeacherForm, type TeacherFormValues, type TeacherLabels } from '@/components/people/TeacherForm';
import { listHref, type PageInfo, type SortDirection } from '@/lib/lists';
import type { FieldErrorMap, ValueLabels } from '@/components/people/types';

/**
 * Teachers list: toolbar, table, pagination and the three modals.
 *
 * The URL is the single source of truth for what is on screen. This component
 * never fetches: it navigates, and the Server Component re-renders the list.
 * The only local state is which modal is open and the last success message.
 *
 * Hiding a button is presentation. A user without `teachers.delete` never sees
 * the trash icon, and the Server Action refuses the call on its own, so a
 * crafted request gains nothing.
 */

export type { TeacherFormValues, TeacherLabels };

/** One teacher as the table needs it, with everything already localised. */
export type TeacherRowView = {
  id: string;
  code: string;
  /** Latin script: the schema forbids anything else, so it is always sortable. */
  firstName: string;
  lastName: string;
  /** "Prénom Nom" in Arabic script, empty when the record has none. */
  nameAr: string;
  phone: string;
  specialization: string;
  status: string;
  groupsCount: number;
  subjectsCount: number;
};

type Filters = { status: string };

type DeleteTarget = { id: string; code: string; name: string } | null;

type Flash = { tone: 'success' | 'danger'; message: string; signature: string };

const BASE_PATH = '/teachers';

/** Identifies the exact view a confirmation message belongs to. */
function viewSignature(
  query: { q: string; sort: string; dir: SortDirection; pageSize: number },
  pagination: PageInfo,
): string {
  return [query.q, query.sort, query.dir, query.pageSize, pagination.page].join('|');
}

/** Teachers share the student status vocabulary, so the badges are the same. */
const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  SUSPENDED: 'warning',
  GRADUATED: 'info',
  LEFT: 'danger',
};

export function TeachersView({
  locale,
  rows,
  pagination,
  query,
  filters,
  editValues,
  statusLabels,
  labels,
  canCreate,
  canUpdate,
  canDelete,
}: {
  locale: string;
  rows: TeacherRowView[];
  pagination: PageInfo;
  query: { q: string; sort: string; dir: SortDirection; pageSize: number };
  filters: Filters;
  /** Full record per id, resolved server-side; only for users who may edit. */
  editValues: Record<string, TeacherFormValues>;
  statusLabels: ValueLabels;
  labels: TeacherLabels;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [flash, setFlash] = useState<Flash | null>(null);

  const filterRecord: Record<string, unknown> = { ...filters };
  const isFiltered = Boolean(query.q || (filters.status && filters.status !== 'ALL'));

  // A confirmation belongs to the view that produced it. Deriving visibility
  // from the current URL instead of clearing it in an effect means a later
  // navigation cannot leave "enseignant créé" on top of a different page.
  const signature = viewSignature(query, pagination);
  const visibleFlash = flash && flash.signature === signature ? flash : null;

  const showFlash = (tone: Flash['tone'], message: string) =>
    setFlash({ tone, message, signature: viewSignature(query, pagination) });

  const displayName = (row: TeacherRowView) =>
    locale === 'ar' && row.nameAr ? row.nameAr : `${row.firstName} ${row.lastName}`;

  const refresh = () => router.refresh();

  const toolbarFilters: ToolbarFilter[] = [
    {
      name: 'status',
      label: labels.status,
      value: filters.status || 'ALL',
      options: Object.keys(statusLabels).map((value) => ({ value, label: statusLabels[value] ?? value })),
    },
  ];

  const columns: Array<Column<TeacherRowView>> = [
    {
      key: 'code',
      header: labels.code,
      sortKey: 'code',
      className: 'font-mono text-xs whitespace-nowrap',
      cell: (row) => row.code,
    },
    {
      key: 'lastName',
      header: labels.lastName,
      sortKey: 'lastName',
      cell: (row) => <span dir="ltr">{row.lastName}</span>,
    },
    {
      key: 'firstName',
      header: labels.firstName,
      sortKey: 'firstName',
      cell: (row) => <span dir="ltr">{row.firstName}</span>,
    },
    {
      key: 'nameAr',
      header: labels.lastNameAr,
      cell: (row) => (row.nameAr ? <span dir="rtl">{row.nameAr}</span> : null),
    },
    {
      key: 'specialization',
      header: labels.specialization,
      cell: (row) => (row.specialization ? <span>{row.specialization}</span> : null),
    },
    {
      key: 'phone',
      header: labels.phone,
      className: 'whitespace-nowrap',
      cell: (row) => (row.phone ? <span dir="ltr">{row.phone}</span> : null),
    },
    {
      key: 'status',
      header: labels.status,
      sortKey: 'status',
      cell: (row) => (
        <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>
          {statusLabels[row.status] ?? row.status}
        </Badge>
      ),
    },
    {
      key: 'groups',
      header: labels.linkedGroups,
      className: 'whitespace-nowrap',
      cell: (row) =>
        row.groupsCount > 0 ? (
          <Badge tone="brand">
            <IconLayers className="size-3" />
            {row.groupsCount}
          </Badge>
        ) : (
          <span className="tabular-nums">0</span>
        ),
    },
    {
      key: 'subjects',
      header: labels.linkedSubjects,
      className: 'whitespace-nowrap',
      cell: (row) =>
        row.subjectsCount > 0 ? (
          <Badge tone="info">
            <IconBook className="size-3" />
            {row.subjectsCount}
          </Badge>
        ) : (
          <span className="tabular-nums">0</span>
        ),
    },
  ];

  if (canUpdate || canDelete) {
    columns.push({
      key: 'actions',
      header: labels.actions,
      headerClassName: 'text-end',
      className: 'text-end whitespace-nowrap',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          {canUpdate ? (
            <Button
              variant="ghost"
              size="iconSm"
              onClick={() => setEditingId(row.id)}
              aria-label={`${labels.edit} ${row.code}`}
              title={labels.edit}
            >
              <IconEdit className="size-4" />
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              variant="ghost"
              size="iconSm"
              className="text-danger-600 hover:bg-danger-50"
              onClick={() => setDeleteTarget({ id: row.id, code: row.code, name: displayName(row) })}
              aria-label={`${labels.delete} ${row.code}`}
              title={labels.delete}
            >
              <IconTrash className="size-4" />
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
      icon={<IconTeacher className="size-8" />}
      action={
        <Button variant="secondary" onClick={() => router.push(listHref(BASE_PATH))}>
          {labels.reset}
        </Button>
      }
    />
  ) : (
    <EmptyState
      title={labels.empty}
      description={labels.subtitle}
      icon={<IconTeacher className="size-8" />}
      action={
        canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>
            <IconPlus className="size-4" />
            {labels.new}
          </Button>
        ) : undefined
      }
    />
  );

  return (
    <div className="space-y-3">
      <ListToolbar
        basePath={BASE_PATH}
        q={query.q}
        query={{ ...query, filter: filterRecord }}
        filters={toolbarFilters}
        searchLabel={labels.search}
        resetLabel={labels.reset}
      >
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>
            <IconPlus className="size-4" />
            {labels.new}
          </Button>
        ) : null}
      </ListToolbar>

      {visibleFlash ? <Alert tone={visibleFlash.tone}>{visibleFlash.message}</Alert> : null}

      <DataTable<TeacherRowView>
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
        <TeacherForm
          key="teacher-create"
          recordId={null}
          values={createValues}
          statusLabels={statusLabels}
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
        <Modal
          open
          onClose={() => setEditingId(null)}
          title={`${labels.edit} · ${editingRow.code}`}
          size="lg"
        >
          <TeacherForm
            key={editingRow.id}
            recordId={editingRow.id}
            values={editingValues}
            statusLabels={statusLabels}
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

      {deleteTarget ? (
        <DeleteTeacherDialog
          key={deleteTarget.id}
          target={deleteTarget}
          labels={labels}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            showFlash('success', labels.deleted);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

const createValues: TeacherFormValues = {
  code: '',
  firstName: '',
  lastName: '',
  firstNameAr: '',
  lastNameAr: '',
  phone: '',
  whatsapp: '',
  email: '',
  cin: '',
  specialization: '',
  bio: '',
  hiredAt: '',
  status: 'ACTIVE',
  notes: '',
};

/**
 * Deletion asks the user to retype the record code.
 *
 * The action rejects a blank confirmation with a VALIDATION error and that
 * message is surfaced verbatim in the alert: the point is to make the failure
 * legible, not to replace the server's wording with a friendlier one.
 */
function DeleteTeacherDialog({
  target,
  labels,
  onClose,
  onDeleted,
}: {
  target: { id: string; code: string; name: string };
  labels: TeacherLabels;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmCode, setConfirmCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});

  const submit = async () => {
    setPending(true);
    setError(undefined);
    setFieldErrors({});
    try {
      const result = await deleteTeacherAction(target.id, confirmCode);
      if (result.ok) {
        onDeleted();
        return;
      }
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
    } catch {
      setError(labels.error);
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={labels.deleteConfirm}
      description={labels.deleteConfirmHint}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {labels.cancel}
          </Button>
          <Button variant="danger" onClick={() => void submit()} disabled={pending}>
            {pending ? <Spinner /> : null}
            {labels.confirm}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <p className="text-sm text-ink-700">
          {target.name} — <span dir="ltr">{target.code}</span>
        </p>
        <Field
          label={labels.code}
          htmlFor="teacher-delete-confirm-code"
          required
          error={fieldErrors.confirmCode?.[0]}
        >
          <Input
            id="teacher-delete-confirm-code"
            value={confirmCode}
            onChange={(event) => setConfirmCode(event.target.value)}
            dir="ltr"
            autoComplete="off"
            invalid={Boolean(fieldErrors.confirmCode)}
          />
        </Field>
      </div>
    </Modal>
  );
}
