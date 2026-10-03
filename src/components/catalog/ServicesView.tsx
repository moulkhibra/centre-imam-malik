'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  IconCalendar,
  IconCash,
  IconCheck,
  IconEdit,
  IconPlus,
  IconTrash,
  Modal,
  Spinner,
} from '@/components/ui';
import { DataTable, ListToolbar, Pagination, type Column, type ToolbarFilter } from '@/components/list';
import { deleteServiceAction } from '@/actions/services';
import { restoreCatalogItemAction } from '@/actions/subjects';
import { ServiceForm } from '@/components/catalog/ServiceForm';
import { listHref, type PageInfo } from '@/lib/lists';
import type { ErrorMessage } from '@/lib/validation/messages';
import type {
  CatalogFilterState,
  CatalogListState,
  FieldErrorMap,
  ServiceFormValues,
  ServiceLabels,
  ServiceRowView,
} from '@/components/catalog/types';

/**
 * Services catalogue: what the centre sells, at what default price and for how
 * long. Same architecture as the people screens - the URL is the whole state,
 * the only local state is which modal is open and the last message.
 *
 * A service is never really deleted: registrations and invoices keep its id, so
 * the action always deactivates and the row stays listed with a restore button.
 */

const BASE_PATH = '/settings/services';

type DeleteTarget = { id: string; code: string; name: string } | null;

type Flash = { tone: 'success' | 'warning' | 'danger'; message: string; errorKey?: ErrorMessage; signature: string };

type CatalogActionResult =
  | { ok: true; data: { deactivated?: boolean } }
  | { ok: false; error: string; errorKey?: ErrorMessage; fieldErrors?: FieldErrorMap };

function viewSignature(
  query: CatalogListState,
  pagination: PageInfo,
): string {
  return [query.q, query.sort, query.dir, query.pageSize, pagination.page].join('|');
}

function ActiveBadge({ active, labels }: { active: boolean; labels: ServiceLabels }) {
  return <Badge tone={active ? 'success' : 'neutral'}>{active ? labels.active : labels.inactive}</Badge>;
}

export function ServicesView({
  rows,
  pagination,
  query,
  filters,
  editValues,
  labels,
  canManage,
}: {
  rows: ServiceRowView[];
  pagination: PageInfo;
  query: CatalogListState;
  filters: CatalogFilterState;
  /** Full record per id, resolved server-side; only for a user allowed to edit. */
  editValues: Record<string, ServiceFormValues>;
  labels: ServiceLabels;
  canManage: boolean;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);

  const filterRecord: Record<string, unknown> = { ...filters };
  const isFiltered = Boolean(query.q || (filters.active && filters.active !== 'ALL'));

  const signature = viewSignature(query, pagination);
  const visibleFlash = flash && flash.signature === signature ? flash : null;

  const showFlash = (tone: Flash['tone'], message: string, errorKey?: ErrorMessage) =>
    setFlash({ tone, message, errorKey, signature: viewSignature(query, pagination) });

  const refresh = () => router.refresh();

  const toolbarFilters: ToolbarFilter[] = [
    {
      name: 'active',
      label: labels.serviceActive,
      value: filters.active || 'ALL',
      options: [
        { value: 'true', label: labels.active },
        { value: 'false', label: labels.inactive },
      ],
    },
  ];

  const restore = async (id: string) => {
    setRestoringId(id);
    try {
      const result = await restoreCatalogItemAction('Service', id);
      if (result.ok) {
        showFlash('success', labels.updated);
        refresh();
      } else {
        showFlash('danger', result.error, result.errorKey);
      }
    } catch {
      showFlash('danger', labels.error);
    } finally {
      setRestoringId(null);
    }
  };

  const columns: Array<Column<ServiceRowView>> = [
    {
      key: 'code',
      header: labels.code,
      sortKey: 'code',
      className: 'font-mono text-xs whitespace-nowrap',
      cell: (row) => <span dir="ltr">{row.code}</span>,
    },
    {
      key: 'nameFr',
      header: labels.nameFr,
      sortKey: 'nameFr',
      cell: (row) => <span dir="ltr">{row.nameFr}</span>,
    },
    {
      key: 'nameAr',
      header: labels.nameAr,
      cell: (row) => (row.nameAr ? <span dir="rtl">{row.nameAr}</span> : null),
    },
    {
      key: 'price',
      header: labels.price,
      sortKey: 'defaultPriceCents',
      className: 'tabular-nums whitespace-nowrap',
      cell: (row) => (
        <span className="inline-flex items-center gap-1">
          <IconCash className="size-3 text-ink-400" />
          <span dir="ltr">{row.price}</span>
        </span>
      ),
    },
    {
      key: 'duration',
      header: labels.duration,
      className: 'tabular-nums whitespace-nowrap',
      cell: (row) =>
        row.durationMinutes > 0 ? (
          <span className="inline-flex items-center gap-1">
            <IconCalendar className="size-3 text-ink-400" />
            <span dir="ltr">{row.durationMinutes}</span>
          </span>
        ) : null,
    },
    {
      key: 'active',
      header: labels.serviceActive,
      className: 'whitespace-nowrap',
      cell: (row) => <ActiveBadge active={row.active} labels={labels} />,
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
          {row.active ? (
            <Button
              variant="ghost"
              size="iconSm"
              onClick={() => setEditingId(row.id)}
              aria-label={`${labels.edit} ${row.code}`}
              title={labels.edit}
            >
              <IconEdit className="size-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="iconSm"
              className="text-ok-600 hover:bg-ok-50"
              disabled={restoringId === row.id}
              onClick={() => void restore(row.id)}
              aria-label={labels.restore}
              title={labels.restore}
            >
              {restoringId === row.id ? <Spinner className="size-4" /> : <IconCheck className="size-4" />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="iconSm"
            className="text-danger-600 hover:bg-danger-50"
            onClick={() => setDeleteTarget({ id: row.id, code: row.code, name: row.nameAr || row.nameFr })}
            aria-label={`${labels.delete} ${row.code}`}
            title={labels.delete}
          >
            <IconTrash className="size-4" />
          </Button>
        </div>
      ),
    });
  }

  const editingRow = editingId ? rows.find((row) => row.id === editingId) : undefined;
  const editingValues = editingId ? editValues[editingId] : undefined;

  const emptyState = isFiltered ? (
    <EmptyState
      title={labels.noResults}
      icon={<IconCash className="size-8" />}
      action={
        <Button variant="secondary" onClick={() => router.push(listHref(BASE_PATH))}>
          {labels.reset}
        </Button>
      }
    />
  ) : (
    <EmptyState
      title={labels.title}
      description={labels.noData}
      icon={<IconCash className="size-8" />}
    />
  );

  return (
    <div className="space-y-3">
      <ListToolbar
        basePath={BASE_PATH}
        q={query.q}
        query={{ sort: query.sort, dir: query.dir, pageSize: query.pageSize, filter: filterRecord }}
        filters={toolbarFilters}
        searchLabel={labels.search}
        resetLabel={labels.reset}
      >
        {canManage ? (
          <Button onClick={() => setCreateOpen(true)}>
            <IconPlus className="size-4" />
            {labels.newService}
          </Button>
        ) : null}
      </ListToolbar>

      {visibleFlash ? (
        <Alert tone={visibleFlash.tone} errorKey={visibleFlash.errorKey}>
          {visibleFlash.message}
        </Alert>
      ) : null}

      <DataTable<ServiceRowView>
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
        title={labels.newService}
        size="lg"
      >
        <ServiceForm
          key="service-create"
          recordId={null}
          values={SERVICE_CREATE_VALUES}
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
          <ServiceForm
            key={editingRow.id}
            recordId={editingRow.id}
            values={editingValues}
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
        <DeleteServiceDialog
          key={deleteTarget.id}
          target={deleteTarget}
          labels={labels}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(deactivated) => {
            setDeleteTarget(null);
            showFlash(deactivated ? 'warning' : 'success', deactivated ? labels.deactivated : labels.deleted);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

const SERVICE_CREATE_VALUES: ServiceFormValues = {
  code: '',
  nameFr: '',
  nameAr: '',
  description: '',
  price: '',
  durationMinutes: '60',
  active: 'true',
};

function DeleteServiceDialog({
  target,
  labels,
  onClose,
  onDeleted,
}: {
  target: { id: string; code: string; name: string };
  labels: ServiceLabels;
  onClose: () => void;
  onDeleted: (deactivated: boolean) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; errorKey?: ErrorMessage } | undefined>(undefined);

  const submit = async () => {
    setPending(true);
    setError(undefined);
    try {
      const result: CatalogActionResult = await deleteServiceAction(target.id);
      if (result.ok) {
        onDeleted(Boolean(result.data.deactivated));
        return;
      }
      setError({ message: result.error, errorKey: result.errorKey });
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
      </div>
    </Modal>
  );
}