'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  IconBook,
  IconCheck,
  IconEdit,
  IconLayers,
  IconPlus,
  IconTrash,
  Modal,
  Spinner,
} from '@/components/ui';
import { DataTable, ListToolbar, Pagination, type Column, type ToolbarFilter } from '@/components/list';
import { deleteRoomAction } from '@/actions/rooms';
import { restoreCatalogItemAction } from '@/actions/subjects';
import { RoomForm } from '@/components/catalog/RoomForm';
import { listHref, type PageInfo } from '@/lib/lists';
import type { ErrorMessage } from '@/lib/validation/messages';
import type {
  CatalogFilterState,
  CatalogListState,
  FieldErrorMap,
  RoomFormValues,
  RoomLabels,
  RoomRowView,
  ValueLabels,
} from '@/components/catalog/types';

/**
 * Rooms catalogue.
 *
 * Two independent switches, deliberately not merged: `status` is the
 * availability the scheduler reads (AVAILABLE / MAINTENANCE / CLOSED) while
 * `active` says whether the room still belongs to the catalogue. A room under
 * maintenance is still an active room, so the two get two columns.
 */

const BASE_PATH = '/settings/rooms';

type DeleteTarget = { id: string; name: string } | null;

type Flash = { tone: 'success' | 'warning' | 'danger'; message: string; errorKey?: ErrorMessage; signature: string };

type CatalogActionResult =
  | { ok: true; data: { deactivated?: boolean } }
  | { ok: false; error: string; errorKey?: ErrorMessage; fieldErrors?: FieldErrorMap };

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  AVAILABLE: 'success',
  MAINTENANCE: 'warning',
  CLOSED: 'danger',
};

function viewSignature(query: CatalogListState, pagination: PageInfo): string {
  return [query.q, query.sort, query.dir, query.pageSize, pagination.page].join('|');
}

function ActiveBadge({ active, labels }: { active: boolean; labels: RoomLabels }) {
  return <Badge tone={active ? 'success' : 'neutral'}>{active ? labels.active : labels.inactive}</Badge>;
}

export function RoomsView({
  rows,
  pagination,
  query,
  filters,
  editValues,
  statusLabels,
  labels,
  canManage,
}: {
  rows: RoomRowView[];
  pagination: PageInfo;
  query: CatalogListState;
  filters: CatalogFilterState;
  /** Full record per id, resolved server-side; only for a user allowed to edit. */
  editValues: Record<string, RoomFormValues>;
  statusLabels: ValueLabels;
  labels: RoomLabels;
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
      label: labels.roomActive,
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
      const result = await restoreCatalogItemAction('Room', id);
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

  const columns: Array<Column<RoomRowView>> = [
    {
      key: 'name',
      header: labels.name,
      sortKey: 'name',
      cell: (row) => <span dir="ltr">{row.name}</span>,
    },
    {
      key: 'capacity',
      header: labels.capacity,
      sortKey: 'capacity',
      className: 'tabular-nums whitespace-nowrap',
      cell: (row) => <span dir="ltr">{row.capacity}</span>,
    },
    {
      key: 'location',
      header: labels.location,
      cell: (row) => (row.location ? <span>{row.location}</span> : null),
    },
    {
      key: 'equipment',
      header: labels.equipment,
      cell: (row) => (row.equipment ? <span>{row.equipment}</span> : null),
    },
    {
      key: 'status',
      header: labels.status,
      sortKey: 'status',
      className: 'whitespace-nowrap',
      cell: (row) => (
        <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>{statusLabels[row.status] ?? row.status}</Badge>
      ),
    },
    {
      key: 'active',
      header: labels.roomActive,
      className: 'whitespace-nowrap',
      cell: (row) => <ActiveBadge active={row.active} labels={labels} />,
    },
    {
      key: 'groups',
      header: labels.groups,
      className: 'whitespace-nowrap',
      cell: (row) => (row.groupsCount > 0 ? <CountBadge value={row.groupsCount} /> : <span className="tabular-nums">0</span>),
    },
    {
      key: 'schedules',
      header: labels.schedules,
      className: 'whitespace-nowrap',
      cell: (row) => (row.schedulesCount > 0 ? <CountBadge value={row.schedulesCount} /> : <span className="tabular-nums">0</span>),
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
              aria-label={`${labels.edit} ${row.name}`}
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
            onClick={() => setDeleteTarget({ id: row.id, name: row.name })}
            aria-label={`${labels.delete} ${row.name}`}
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
      icon={<IconBook className="size-8" />}
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
      icon={<IconBook className="size-8" />}
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
        searchPlaceholder={labels.searchPlaceholder}
        searchAction={labels.searchAction}
        resetLabel={labels.reset}
      >
        {canManage ? (
          <Button onClick={() => setCreateOpen(true)}>
            <IconPlus className="size-4" />
            {labels.newRoom}
          </Button>
        ) : null}
      </ListToolbar>

      {visibleFlash ? (
        <Alert tone={visibleFlash.tone} errorKey={visibleFlash.errorKey}>
          {visibleFlash.message}
        </Alert>
      ) : null}

      <DataTable<RoomRowView>
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={labels.newRoom} size="lg">
        <RoomForm
          key="room-create"
          recordId={null}
          values={ROOM_CREATE_VALUES}
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
          title={`${labels.edit} · ${editingRow.name}`}
          size="lg"
        >
          <RoomForm
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
        <DeleteRoomDialog
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

const ROOM_CREATE_VALUES: RoomFormValues = {
  name: '',
  capacity: '20',
  location: '',
  equipment: '',
  status: 'AVAILABLE',
  notes: '',
  active: 'true',
};

function CountBadge({ value }: { value: number }) {
  return (
    <Badge tone="brand">
      <IconLayers className="size-3" />
      {value}
    </Badge>
  );
}

function DeleteRoomDialog({
  target,
  labels,
  onClose,
  onDeleted,
}: {
  target: { id: string; name: string };
  labels: RoomLabels;
  onClose: () => void;
  onDeleted: (deactivated: boolean) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; errorKey?: ErrorMessage } | undefined>(undefined);

  const submit = async () => {
    setPending(true);
    setError(undefined);
    try {
      const result: CatalogActionResult = await deleteRoomAction(target.id);
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
        <p className="text-sm text-ink-700">{target.name}</p>
      </div>
    </Modal>
  );
}