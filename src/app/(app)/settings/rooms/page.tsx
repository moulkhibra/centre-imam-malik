import { requireUser, can } from '@/lib/auth/permissions';
import { createTranslator, getLocaleFromCookies } from '@/lib/i18n';
import { ErrorState, PageHeader } from '@/components/ui';
import { RoomsView } from '@/components/catalog/RoomsView';
import { getRoom, listRooms } from '@/lib/catalog/queries';
import { ROOM_STATUSES } from '@/lib/constants';
import type {
  RoomFormValues,
  RoomLabels,
  RoomRowView,
  ValueLabels,
} from '@/components/catalog/types';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RoomsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();

  // The screen is a permission, not a link: a user without it gets no rows and
  // no toolbar whatever the URL says.
  if (!can(user, 'academics.view')) {
    const localeForError = await getLocaleFromCookies();
    return <ErrorState title={createTranslator(localeForError)('errors.forbidden')} />;
  }

  const canManage = can(user, 'academics.manage');

  const [locale, params] = await Promise.all([getLocaleFromCookies(), searchParams]);
  const t = createTranslator(locale);

  const { rows, pagination, query } = await listRooms(user.centerId, params);

  // The table shows a projection; the edit form must post every field the
  // update action writes. Resolved for the rows on screen, and only for a user
  // allowed to edit.
  const editValues: Record<string, RoomFormValues> = {};
  if (canManage) {
    const full = await Promise.all(rows.map((row) => getRoom(user.centerId, row.id)));
    full.forEach((room, index) => {
      const row = rows[index];
      if (!room || !row) return;
      editValues[room.id] = {
        name: room.name,
        capacity: String(room.capacity),
        location: room.location ?? '',
        equipment: room.equipment ?? '',
        status: room.status,
        notes: room.notes ?? '',
        active: room.active ? 'true' : '',
      };
    });
  }

  const viewRows: RoomRowView[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    capacity: row.capacity,
    location: row.location ?? '',
    equipment: row.equipment ?? '',
    status: row.status,
    active: row.active,
    groupsCount: row._count.groups,
    schedulesCount: row._count.schedules,
  }));

  const statusLabels = Object.fromEntries(
    ROOM_STATUSES.map((value) => [value, t(`common.roomStatusValues.${value}`)]),
  ) as ValueLabels;

  const labels: RoomLabels = {
    // `nav` has no `rooms` entry; `group.room` is the same noun the centre
    // already uses for a classroom in the group form.
    title: t('group.room'),
    name: t('room.name'),
    capacity: t('room.capacity'),
    location: t('room.location'),
    equipment: t('room.equipment'),
    notes: t('room.notes'),
    groups: t('room.groups'),
    schedules: t('room.schedules'),
    roomActive: t('room.active'),
    // Shared chrome.
    search: t('common.search'),
    reset: t('common.reset'),
    all: t('common.all'),
    noResults: t('common.noResults'),
    noData: t('common.noData'),
    status: t('room.status'),
    actions: t('common.actions'),
    edit: t('common.edit'),
    delete: t('common.delete'),
    restore: t('common.restore'),
    create: t('common.create'),
    save: t('common.save'),
    cancel: t('common.cancel'),
    close: t('common.close'),
    confirm: t('common.confirm'),
    required: t('common.required'),
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
    to: t('common.to'),
  };

  return (
    <>
      <PageHeader title={t('group.room')} />
      <RoomsView
        rows={viewRows}
        pagination={pagination}
        query={{ q: query.q, sort: query.sort, dir: query.dir, pageSize: query.pageSize }}
        filters={{ active: query.filter.active, stage: query.filter.stage }}
        editValues={editValues}
        statusLabels={statusLabels}
        labels={labels}
        canManage={canManage}
      />
    </>
  );
}