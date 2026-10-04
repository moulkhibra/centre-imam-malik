'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  IconEdit,
  IconPlus,
  IconTrash,
  IconUser,
  IconUsers,
  Input,
  Modal,
  Spinner,
} from '@/components/ui';
import {
  DataTable,
  ListToolbar,
  Pagination,
  type Column,
} from '@/components/list';
import { deleteParentAction } from '@/actions/parents';
import { ParentForm } from '@/components/people/ParentForm';
import { listHref, type PageInfo, type SortDirection } from '@/lib/lists';
import type { ErrorMessage } from '@/lib/validation/messages';
import type {
  FieldErrorMap,
  ParentFormValues,
  ParentRowView,
  PeopleLabels,
} from '@/components/people/types';

/**
 * Parents list.
 *
 * Same shape as `StudentsView`: the URL drives search, sort and pagination, the
 * Server Component owns the data, and this component owns the modals. The
 * delete confirmation is the one place the server speaks first, because
 * `deleteParentAction` also refuses to orphan a linked student.
 */

type DeleteTarget = { id: string; code: string; name: string } | null;

type Flash = { tone: 'success' | 'danger'; message: string; errorKey?: ErrorMessage; signature: string };

/** Identifies the exact view a confirmation message belongs to. */
function viewSignature(
  query: { q: string; sort: string; dir: SortDirection; pageSize: number },
  pagination: PageInfo,
): string {
  return [query.q, query.sort, query.dir, query.pageSize, pagination.page].join('|');
}

const createValues: ParentFormValues = {
  code: '',
  firstName: '',
  lastName: '',
  cin: '',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  city: '',
  relation: '',
  notes: '',
};

export function ParentsView({
  rows,
  pagination,
  query,
  editValues,
  labels,
  canCreate,
  canUpdate,
  canDelete,
}: {
  rows: ParentRowView[];
  pagination: PageInfo;
  query: { q: string; sort: string; dir: SortDirection; pageSize: number };
  editValues: Record<string, ParentFormValues>;
  labels: PeopleLabels;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [flash, setFlash] = useState<Flash | null>(null);

  const isFiltered = Boolean(query.q);
  const displayName = (row: ParentRowView) => `${row.firstName} ${row.lastName}`;

  // A confirmation belongs to the view that produced it: deriving its visibility
  // from the current URL keeps it from surviving a later navigation.
  const signature = viewSignature(query, pagination);
  const visibleFlash = flash && flash.signature === signature ? flash : null;
  const showFlash = (tone: Flash['tone'], message: string, errorKey?: ErrorMessage) =>
    setFlash({ tone, message, errorKey, signature: viewSignature(query, pagination) });

  const columns: Array<Column<ParentRowView>> = [
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
      key: 'phone',
      header: labels.phone,
      className: 'whitespace-nowrap',
      cell: (row) => (row.phone ? <span dir="ltr">{row.phone}</span> : null),
    },
    {
      key: 'city',
      header: labels.city,
      cell: (row) => (row.city ? <span>{row.city}</span> : null),
    },
    {
      key: 'students',
      header: labels.linkedStudents,
      className: 'whitespace-nowrap',
      cell: (row) =>
        row.studentsCount > 0 ? (
          <Badge tone="brand">
            <IconUsers className="size-3" />
            {row.studentsCount}
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
      icon={<IconUser className="size-8" />}
      action={
        <Button variant="secondary" onClick={() => router.push(listHref('/parents'))}>
          {labels.reset}
        </Button>
      }
    />
  ) : (
    <EmptyState
      title={labels.empty}
      description={labels.subtitle}
      icon={<IconUser className="size-8" />}
    />
  );

  return (
    <div className="space-y-3">
      <ListToolbar
        basePath="/parents"
        q={query.q}
        query={{ ...query, filter: {} }}
        searchLabel={labels.search}
        searchPlaceholder={labels.searchPlaceholder}
        searchAction={labels.searchAction}
        resetLabel={labels.reset}
      >
        {canCreate ? (
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

      <DataTable<ParentRowView>
        basePath="/parents"
        columns={columns}
        rows={rows}
        current={{ sort: query.sort, dir: query.dir, pageSize: query.pageSize }}
        q={query.q}
        caption={labels.title}
        emptyState={emptyState}
      />

      <Pagination
        basePath="/parents"
        pagination={pagination}
        current={{ sort: query.sort, dir: query.dir, pageSize: query.pageSize }}
        q={query.q}
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
      >
        <ParentForm
          key="parent-create"
          recordId={null}
          values={createValues}
          labels={labels}
          onCancel={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            showFlash('success', labels.created);
            router.refresh();
          }}
        />
      </Modal>

      {editingRow && editingValues ? (
        <Modal
          open
          onClose={() => setEditingId(null)}
          title={`${labels.edit} · ${editingRow.code}`}
        >
          <ParentForm
            key={editingRow.id}
            recordId={editingRow.id}
            values={editingValues}
            labels={labels}
            onCancel={() => setEditingId(null)}
            onSaved={() => {
              setEditingId(null);
              showFlash('success', labels.updated);
              router.refresh();
            }}
          />
        </Modal>
      ) : null}

      {deleteTarget ? (
        <DeleteParentDialog
          key={deleteTarget.id}
          target={deleteTarget}
          labels={labels}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            showFlash('success', labels.deleted);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/** See `DeleteStudentDialog`: the confirmation text comes from the action. */
function DeleteParentDialog({
  target,
  labels,
  onClose,
  onDeleted,
}: {
  target: { id: string; code: string; name: string };
  labels: PeopleLabels;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmCode, setConfirmCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; errorKey?: ErrorMessage } | undefined>(undefined);
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});

  const submit = async () => {
    setPending(true);
    setError(undefined);
    setFieldErrors({});
    try {
      const result = await deleteParentAction(target.id, confirmCode);
      if (result.ok) {
        onDeleted();
        return;
      }
      setError({ message: result.error, errorKey: result.errorKey });
      setFieldErrors(result.fieldErrors ?? {});
    } catch {
      setError({ message: labels.error });
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
        {error ? (
          <Alert tone="danger" errorKey={error.errorKey}>
            {error.message}
          </Alert>
        ) : null}
        <p className="text-sm text-ink-700">
          {target.name} — <span dir="ltr">{target.code}</span>
        </p>
        <Field
          label={labels.code}
          htmlFor="delete-confirm-code"
          required
          error={fieldErrors.confirmCode?.[0]}
        >
          <Input
            id="delete-confirm-code"
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
