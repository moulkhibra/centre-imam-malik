'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
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
import { DataTable, Pagination, type Column, type ToolbarFilter } from '@/components/list';
import { usePendingFilters } from '@/components/list/use-pending-filters';
import { deleteLevelAction } from '@/actions/levels';
import { deleteSubjectAction, restoreCatalogItemAction } from '@/actions/subjects';
import { LevelForm } from '@/components/catalog/LevelForm';
import { SubjectForm } from '@/components/catalog/SubjectForm';
import { listHref, type PageInfo, type SortDirection } from '@/lib/lists';
import { cn } from '@/lib/utils/cn';
import type {
  AcademicsLabels,
  AcademicsTab,
  AcademicsTabState,
  CategoryOptionView,
  FieldErrorMap,
  LevelFormValues,
  LevelRowView,
  SubjectFormValues,
  SubjectRowView,
  ValueLabels,
} from '@/components/catalog/types';

/**
 * Academics reference: academic levels, subjects and languages.
 *
 * The three tabs live on one page and are driven by `?tab=`, never by local
 * state: a tab is a URL, so it can be bookmarked, shared and reached with the
 * back button. The Server Component fetches only the active tab, and every
 * control in here (search, filters, sort headers, pagination) is a link that
 * carries `tab` along in the filter record, so changing a sort never silently
 * falls back to the first tab.
 *
 * Hiding a button is presentation. Without `academics.manage` a secretary sees
 * the catalogue read-only, and each Server Action re-checks the permission on
 * its own, so a crafted request gains nothing.
 */

const BASE_PATH = '/settings/academics';

const TABS: AcademicsTab[] = ['levels', 'subjects', 'languages'];

type DeleteTarget = { id: string; name: string; code: string } | null;

type Flash = { tone: 'success' | 'warning' | 'danger'; message: string; signature: string };

/**
 * Structural view of an `ActionResult`.
 *
 * Declared here instead of imported: `@/lib/utils/errors` re-exports Prisma,
 * and a type-only import would still put the database types in the client's
 * module graph.
 */
type CatalogActionResult =
  | { ok: true; data: { deactivated?: boolean } }
  | { ok: false; error: string; fieldErrors?: FieldErrorMap };

/** Identifies the exact view a confirmation message belongs to. */
function viewSignature(
  query: { q: string; sort: string; dir: SortDirection; pageSize: number },
  pagination: PageInfo,
  tab: AcademicsTab,
): string {
  return [tab, query.q, query.sort, query.dir, query.pageSize, pagination.page].join('|');
}

/** The list helpers drop an empty filter value, so `tab` rides along as one. */
function withTab(href: string, tab: AcademicsTab): string {
  return `${href}${href.includes('?') ? '&' : '?'}tab=${tab}`;
}

function ActiveBadge({ active, labels }: { active: boolean; labels: AcademicsLabels }) {
  return <Badge tone={active ? 'success' : 'neutral'}>{active ? labels.active : labels.inactive}</Badge>;
}

function CountBadge({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'info' }) {
  if (value === 0) return <span className="tabular-nums">0</span>;
  return (
    <Badge tone={tone}>
      {tone === 'brand' ? <IconLayers className="size-3" /> : <IconBook className="size-3" />}
      {value}
    </Badge>
  );
}

export function AcademicsView({
  state,
  stageLabels,
  categoryOptions,
  labels,
  canManage,
}: {
  /** Only the active tab is populated. */
  state: AcademicsTabState;
  stageLabels: ValueLabels;
  categoryOptions: CategoryOptionView[];
  labels: AcademicsLabels;
  canManage: boolean;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);

  const tab = state.tab;
  // `rows` is read through `levelRows` / `subjectRows` below: the union is
  // narrowed by tab before any row is touched.
  const { pagination, query, filters } = state;
  const languageMode = tab === 'languages';
  const isLevelTab = tab === 'levels';

  const filterRecord: Record<string, unknown> = { ...filters, tab };

  const isFiltered = Boolean(
    query.q ||
      (filters.active && filters.active !== 'ALL') ||
      (tab === 'levels' && filters.stage),
  );

  // A confirmation belongs to the view that produced it: deriving visibility
  // from the current URL means a later navigation can never leave "niveau
  // créé" on top of a different list.
  const signature = viewSignature(query, pagination, tab);
  const visibleFlash = flash && flash.signature === signature ? flash : null;

  const showFlash = (tone: Flash['tone'], message: string) =>
    setFlash({ tone, message, signature: viewSignature(query, pagination, tab) });

  const refresh = () => router.refresh();

  const tabTitle = isLevelTab ? labels.levels : languageMode ? labels.languages : labels.subjects;
  const newLabel = isLevelTab
    ? labels.newLevel
    : languageMode
      ? labels.newLanguage
      : labels.newSubject;
  const editLabel = isLevelTab
    ? labels.editLevel
    : languageMode
      ? labels.editLanguage
      : labels.editSubject;

  const toolbarFilters: ToolbarFilter[] = [
    {
      name: 'active',
      label: labels.active,
      value: filters.active || 'ALL',
      options: [
        { value: 'true', label: labels.active },
        { value: 'false', label: labels.inactive },
      ],
    },
  ];

  if (tab === 'levels') {
    toolbarFilters.push({
      name: 'stage',
      label: labels.levelStage,
      value: filters.stage || 'ALL',
      options: Object.keys(stageLabels).map((value) => ({ value, label: stageLabels[value] ?? value })),
    });
  }

  const levelRows: LevelRowView[] = state.tab === 'levels' ? state.rows : [];
  const subjectRows: SubjectRowView[] = state.tab === 'levels' ? [] : state.rows;

  // The edit modal opens only when the server really sent that row's full
  // record. Substituting blank create values would submit an empty form against
  // a live level or subject, so a missing entry shows no modal at all - the same
  // guard StudentsView and RoomsView use.
  const editingLevelId = isLevelTab ? editingId : null;
  const editingSubjectId = isLevelTab ? null : editingId;
  // Narrowing on `state.tab` (not on `isLevelTab`) is what gives the two records
  // their own value type instead of the union of both.
  const levelEditValues =
    state.tab === 'levels' && editingId ? state.editValues[editingId] : undefined;
  const subjectEditValues =
    state.tab !== 'levels' && editingId ? state.editValues[editingId] : undefined;

  const displayName = (row: LevelRowView | SubjectRowView) => row.nameAr || row.nameFr;

  const restore = async (entity: 'AcademicLevel' | 'Subject', id: string) => {
    setRestoringId(id);
    try {
      const result = await restoreCatalogItemAction(entity, id);
      if (result.ok) {
        showFlash('success', labels.updated);
        refresh();
      } else {
        showFlash('danger', result.error);
      }
    } catch {
      showFlash('danger', labels.error);
    } finally {
      setRestoringId(null);
    }
  };

  /** Restore is offered only on a deactivated row, and only to a manager. */
  const restoreButton = (id: string, entity: 'AcademicLevel' | 'Subject') => (
    <Button
      variant="ghost"
      size="iconSm"
      disabled={restoringId === id}
      onClick={() => void restore(entity, id)}
      aria-label={labels.restore}
      title={labels.restore}
      className="text-ok-600 hover:bg-ok-50"
    >
      {restoringId === id ? <Spinner className="size-4" /> : <IconCheck className="size-4" />}
    </Button>
  );

  const levelColumns: Array<Column<LevelRowView>> = [
    {
      key: 'code',
      header: labels.code,
      sortKey: 'code',
      className: 'font-mono text-xs whitespace-nowrap',
      cell: (row) => <span dir="ltr">{row.code}</span>,
    },
    {
      key: 'nameFr',
      header: labels.levelNameFr,
      sortKey: 'nameFr',
      cell: (row) => <span dir="ltr">{row.nameFr}</span>,
    },
    {
      key: 'nameAr',
      header: labels.levelNameAr,
      cell: (row) => (row.nameAr ? <span dir="rtl">{row.nameAr}</span> : null),
    },
    {
      key: 'stage',
      header: labels.levelStage,
      sortKey: 'stage',
      className: 'whitespace-nowrap',
      cell: (row) => <Badge tone="info">{stageLabels[row.stage] ?? row.stage}</Badge>,
    },
    {
      key: 'sortOrder',
      header: labels.levelSortOrder,
      sortKey: 'sortOrder',
      className: 'tabular-nums whitespace-nowrap',
      cell: (row) => row.sortOrder,
    },
    {
      key: 'active',
      header: labels.levelActive,
      className: 'whitespace-nowrap',
      cell: (row) => <ActiveBadge active={row.active} labels={labels} />,
    },
    {
      key: 'students',
      header: labels.levelStudents,
      className: 'whitespace-nowrap',
      cell: (row) => <CountBadge value={row.studentsCount} tone="info" />,
    },
    {
      key: 'groups',
      header: labels.levelGroups,
      className: 'whitespace-nowrap',
      cell: (row) => <CountBadge value={row.groupsCount} />,
    },
  ];

  const subjectColumns: Array<Column<SubjectRowView>> = [
    {
      key: 'code',
      header: labels.code,
      sortKey: 'code',
      className: 'font-mono text-xs whitespace-nowrap',
      cell: (row) => <span dir="ltr">{row.code}</span>,
    },
    {
      key: 'nameFr',
      header: labels.subjectNameFr,
      sortKey: 'nameFr',
      cell: (row) => <span dir="ltr">{row.nameFr}</span>,
    },
    {
      key: 'nameAr',
      header: labels.subjectNameAr,
      cell: (row) => (row.nameAr ? <span dir="rtl">{row.nameAr}</span> : null),
    },
    {
      key: 'category',
      header: labels.subjectCategory,
      cell: (row) => (row.categoryLabel ? <span>{row.categoryLabel}</span> : null),
    },
    {
      key: 'isLanguage',
      header: labels.subjectIsLanguage,
      className: 'whitespace-nowrap',
      cell: (row) => (row.isLanguage ? <Badge tone="brand">{labels.languages}</Badge> : null),
    },
    {
      key: 'active',
      header: labels.subjectActive,
      className: 'whitespace-nowrap',
      cell: (row) => <ActiveBadge active={row.active} labels={labels} />,
    },
    {
      key: 'groups',
      header: labels.subjectGroups,
      className: 'whitespace-nowrap',
      cell: (row) => <CountBadge value={row.groupsCount} />,
    },
    {
      key: 'teachers',
      header: labels.subjectTeachers,
      className: 'whitespace-nowrap',
      cell: (row) => <CountBadge value={row.teachingAssignmentsCount} tone="info" />,
    },
  ];

  if (canManage) {
    const levelActions: Column<LevelRowView> = {
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
            restoreButton(row.id, 'AcademicLevel')
          )}
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
        </div>
      ),
    };

    const subjectActions: Column<SubjectRowView> = {
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
            restoreButton(row.id, 'Subject')
          )}
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
        </div>
      ),
    };

    levelColumns.push(levelActions);
    subjectColumns.push(subjectActions);
  }

  const emptyState = isFiltered ? (
    <EmptyState
      title={labels.noResults}
      icon={isLevelTab ? <IconLayers className="size-8" /> : <IconBook className="size-8" />}
      action={
        <Button variant="secondary" onClick={() => router.push(withTab(listHref(BASE_PATH, {}), tab))}>
          {labels.reset}
        </Button>
      }
    />
  ) : (
    <EmptyState
      title={tabTitle}
      description={labels.noData}
      icon={isLevelTab ? <IconLayers className="size-8" /> : <IconBook className="size-8" />}
    />
  );

  return (
    <div className="space-y-3">
      <nav
        aria-label={labels.title}
        className="flex flex-wrap gap-1 border-b border-ink-200"
      >
        {TABS.map((value) => (
          <Link
            key={value}
            href={`${BASE_PATH}?tab=${value}`}
            aria-current={tab === value ? 'page' : undefined}
            className={cn(
              'rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium',
              tab === value
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-ink-600 hover:bg-ink-50 hover:text-ink-900',
            )}
          >
            {value === 'levels'
              ? labels.tabs.levels
              : value === 'subjects'
                ? labels.tabs.subjects
                : labels.tabs.languages}
          </Link>
        ))}
      </nav>

      <CatalogToolbar
        tab={tab}
        q={query.q}
        sort={query.sort}
        dir={query.dir}
        pageSize={query.pageSize}
        filters={filters}
        filtersList={toolbarFilters}
        labels={labels}
      >
        {canManage ? (
          <Button onClick={() => setCreateOpen(true)}>
            <IconPlus className="size-4" />
            {newLabel}
          </Button>
        ) : null}
      </CatalogToolbar>

      {visibleFlash ? <Alert tone={visibleFlash.tone}>{visibleFlash.message}</Alert> : null}

      {isLevelTab ? (
        <DataTable<LevelRowView>
          basePath={BASE_PATH}
          columns={levelColumns}
          rows={levelRows}
          current={{ sort: query.sort, dir: query.dir, pageSize: query.pageSize }}
          q={query.q}
          filter={filterRecord}
          caption={labels.levels}
          emptyState={emptyState}
        />
      ) : (
        <DataTable<SubjectRowView>
          basePath={BASE_PATH}
          columns={subjectColumns}
          rows={subjectRows}
          current={{ sort: query.sort, dir: query.dir, pageSize: query.pageSize }}
          q={query.q}
          filter={filterRecord}
          caption={tabTitle}
          emptyState={emptyState}
        />
      )}

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

      {isLevelTab ? (
        <Modal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title={labels.newLevel}
          description={labels.subtitle}
          size="lg"
        >
          <LevelForm
            key="level-create"
            recordId={null}
            values={LEVEL_CREATE_VALUES}
            stageLabels={stageLabels}
            labels={labels}
            onCancel={() => setCreateOpen(false)}
            onSaved={() => {
              setCreateOpen(false);
              showFlash('success', labels.created);
              refresh();
            }}
          />
        </Modal>
      ) : null}

      {!isLevelTab ? (
        <Modal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title={languageMode ? labels.newLanguage : labels.newSubject}
          description={labels.subtitle}
          size="lg"
        >
          <SubjectForm
            key={languageMode ? 'language-create' : 'subject-create'}
            recordId={null}
            values={SUBJECT_CREATE_VALUES}
            languageMode={languageMode}
            categoryOptions={categoryOptions}
            labels={labels}
            onCancel={() => setCreateOpen(false)}
            onSaved={() => {
              setCreateOpen(false);
              showFlash('success', labels.created);
              refresh();
            }}
          />
        </Modal>
      ) : null}

      {editingLevelId && levelEditValues ? (
        <Modal
          open
          onClose={() => setEditingId(null)}
          title={`${labels.editLevel} · ${levelRows.find((row) => row.id === editingLevelId)?.code ?? ''}`}
          size="lg"
        >
          <LevelForm
            key={editingLevelId}
            recordId={editingLevelId}
            values={levelEditValues}
            stageLabels={stageLabels}
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

      {editingSubjectId && subjectEditValues ? (
        <Modal
          open
          onClose={() => setEditingId(null)}
          title={`${editLabel} · ${subjectRows.find((row) => row.id === editingSubjectId)?.code ?? ''}`}
          size="lg"
        >
          <SubjectForm
            key={`${tab}-${editingSubjectId}`}
            recordId={editingSubjectId}
            values={subjectEditValues}
            languageMode={languageMode}
            categoryOptions={categoryOptions}
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
        <DeleteCatalogDialog
          key={deleteTarget.id}
          target={deleteTarget}
          labels={labels}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(deactivated) => {
            setDeleteTarget(null);
            showFlash(deactivated ? 'warning' : 'success', deactivated ? labels.deactivated : labels.deleted);
            refresh();
          }}
          confirm={async () => (isLevelTab ? deleteLevelAction(deleteTarget.id) : deleteSubjectAction(deleteTarget.id))}
        />
      ) : null}
    </div>
  );
}

const LEVEL_CREATE_VALUES: LevelFormValues = {
  code: '',
  stage: 'PRIMAIRE',
  nameFr: '',
  nameAr: '',
  sortOrder: '0',
  active: 'true',
};

const SUBJECT_CREATE_VALUES: SubjectFormValues = {
  code: '',
  nameFr: '',
  nameAr: '',
  categoryId: '',
  description: '',
  isLanguage: 'false',
  active: 'true',
};

/**
 * Toolbar of the academics screen.
 *
 * Mirrors `ListToolbar` from `@/components/list` down to the markup and the
 * classes, with one addition: every URL it builds carries `tab`, and the search
 * form posts it as a hidden field. That extra parameter is why the tab screen
 * needs its own toolbar - the shared one assumes its `basePath` is a bare path
 * and would drop the parameter from a filter change or a sort click.
 */
function CatalogToolbar({
  tab,
  q,
  sort,
  dir,
  pageSize,
  filters,
  filtersList,
  labels,
  children,
}: {
  tab: AcademicsTab;
  q: string;
  sort: string;
  dir: SortDirection;
  pageSize: number;
  filters: { active: string; stage: string };
  filtersList: ToolbarFilter[];
  labels: AcademicsLabels;
  children?: ReactNode;
}) {
  const router = useRouter();

  // `'ALL'` and `''` both mean "no filter" here, so they are normalised to `''`
  // once: the hook compares values to decide whether a change has been adopted,
  // and two spellings of the same state would keep it waiting forever.
  const { values: activeFilters, change } = usePendingFilters({
    active: filters.active === 'ALL' ? '' : filters.active,
    stage: filters.stage === 'ALL' ? '' : filters.stage,
  });

  const hasFilters = Boolean(q || activeFilters.active || activeFilters.stage);

  const applyFilter = (name: string, value: string) => {
    const next = change(name as 'active' | 'stage', value === 'ALL' ? '' : value);
    // Back to page 1: a filter that shrinks the list must not strand the user
    // on an empty page 4.
    router.push(
      withTab(listHref(BASE_PATH, { q, sort, dir, pageSize, page: 1, filter: { ...next, tab } }), tab),
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <form action={BASE_PATH} method="get" className="flex flex-1 items-center gap-2">
          <input type="hidden" name="tab" value={tab} />
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={dir} />
          <input type="hidden" name="pageSize" value={pageSize} />
          {activeFilters.active ? (
            <input type="hidden" name="active" value={activeFilters.active} />
          ) : null}
          {activeFilters.stage ? <input type="hidden" name="stage" value={activeFilters.stage} /> : null}

          <label className="sr-only" htmlFor="catalog-search">
            {labels.search}
          </label>
          <div className="relative flex-1">
            <input
              id="catalog-search"
              type="search"
              name="q"
              defaultValue={q}
              placeholder={labels.search}
              className="w-full rounded-lg border border-ink-200 bg-white py-2 pe-9 ps-9 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-ink-400"
            >
              <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M20 20l-4-4" strokeLinecap="round" />
              </svg>
            </span>
          </div>
          <button
            type="submit"
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            {labels.search}
          </button>
        </form>

        {children}
      </div>

      {filtersList.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2">
          {filtersList.map((filter) => (
            <div key={filter.name} className="flex flex-col gap-1">
              <label htmlFor={`filter-${filter.name}`} className="text-xs font-medium text-ink-500">
                {filter.label}
              </label>
              <select
                id={`filter-${filter.name}`}
                value={activeFilters[filter.name as 'active' | 'stage'] || 'ALL'}
                onChange={(event) => applyFilter(filter.name, event.target.value)}
                className="rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                <option value="ALL">—</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {hasFilters ? (
            <Link href={withTab(listHref(BASE_PATH, {}), tab)} className="rounded-lg px-2 py-1.5 text-sm text-ink-600 underline hover:text-ink-900">
              {labels.reset}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Confirmation before a catalogue row is removed.
 *
 * Unlike the people screens there is no code to retype: these rows are short
 * lists of reference data, but the action may only *deactivate* one of them
 * (a level with enrolled students, every subject, service and room). The
 * caller decides which message to show from the `deactivated` flag, because
 * "deleted" and "deactivated" are different facts about the database.
 */
function DeleteCatalogDialog({
  target,
  labels,
  onClose,
  onDeleted,
  confirm,
}: {
  target: { id: string; name: string; code: string };
  labels: AcademicsLabels;
  onClose: () => void;
  onDeleted: (deactivated: boolean) => void;
  confirm: () => Promise<CatalogActionResult>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const submit = async () => {
    setPending(true);
    setError(undefined);
    try {
      const result = await confirm();
      if (result.ok) {
        onDeleted(Boolean(result.data.deactivated));
        return;
      }
      setError(result.error);
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
          {target.name}
          {target.code ? (
            <>
              {' — '}
              <span dir="ltr">{target.code}</span>
            </>
          ) : null}
        </p>
      </div>
    </Modal>
  );
}