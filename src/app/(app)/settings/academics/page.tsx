import { requireUser, can } from '@/lib/auth/permissions';
import { createTranslator, getLocaleFromCookies } from '@/lib/i18n';
import { ErrorState, PageHeader } from '@/components/ui';
import { AcademicsView } from '@/components/catalog/AcademicsView';
import {
  getLevel,
  getSubject,
  listLevels,
  listSubjectCategories,
  listSubjects,
} from '@/lib/catalog/queries';
import { localisedName } from '@/lib/people/queries';
import { ACADEMIC_STAGES } from '@/lib/constants';
import type {
  AcademicsLabels,
  AcademicsTab,
  AcademicsTabState,
  CategoryOptionView,
  LevelFormValues,
  LevelRowView,
  SubjectFormValues,
  SubjectRowView,
  ValueLabels,
} from '@/components/catalog/types';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TABS: AcademicsTab[] = ['levels', 'subjects', 'languages'];

/**
 * A hand-edited URL must not 500: an unknown tab falls back to the first one,
 * and every list query drops what it does not understand.
 */
function readTab(value: string | string[] | undefined): AcademicsTab {
  return typeof value === 'string' && (TABS as string[]).includes(value) ? (value as AcademicsTab) : 'levels';
}

export default async function AcademicsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();

  // The screen is a permission, not a link: a user without it gets no rows and
  // no toolbar whatever the URL says.
  if (!can(user, 'academics.view')) {
    const localeForError = await getLocaleFromCookies();
    return <ErrorState title={createTranslator(localeForError)('errors.forbidden')} />;
  }

  // One permission governs the whole reference: levels, subjects and languages
  // are the academic structure, so a secretary can read it but not rewrite it.
  const canManage = can(user, 'academics.manage');

  const [locale, params] = await Promise.all([getLocaleFromCookies(), searchParams]);
  const t = createTranslator(locale);

  const tab = readTab(params.tab);
  const centerId = user.centerId;

  // Only the active tab is fetched: a language search never pays for the level
  // list, and the view receives exactly the state it is going to render.
  let state: AcademicsTabState;

  if (tab === 'levels') {
    const { rows, pagination, query } = await listLevels(centerId, params);

    // The table shows a projection; the edit form must post every field the
    // update action writes. Resolved for the rows actually on screen, and only
    // for a user allowed to edit.
    const editValues: Record<string, LevelFormValues> = {};
    if (canManage) {
      const full = await Promise.all(rows.map((row) => getLevel(centerId, row.id)));
      full.forEach((level, index) => {
        const row = rows[index];
        if (!level || !row) return;
        editValues[level.id] = {
          code: level.code,
          stage: level.stage,
          nameFr: level.nameFr,
          nameAr: level.nameAr ?? '',
          sortOrder: String(level.sortOrder),
          active: level.active ? 'true' : '',
        };
      });
    }

    const viewRows: LevelRowView[] = rows.map((row) => ({
      id: row.id,
      code: row.code,
      nameFr: row.nameFr,
      nameAr: row.nameAr ?? '',
      stage: row.stage,
      sortOrder: row.sortOrder,
      active: row.active,
      studentsCount: row._count.students,
      groupsCount: row._count.groups,
    }));

    state = {
      tab: 'levels',
      rows: viewRows,
      editValues,
      pagination,
      query: { q: query.q, sort: query.sort, dir: query.dir, pageSize: query.pageSize },
      filters: { active: query.filter.active, stage: query.filter.stage },
    };
  } else {
    const languagesOnly = tab === 'languages';
    const { rows, pagination, query } = await listSubjects(centerId, params, { languagesOnly });

    const editValues: Record<string, SubjectFormValues> = {};
    if (canManage) {
      const full = await Promise.all(rows.map((row) => getSubject(centerId, row.id)));
      full.forEach((subject, index) => {
        const row = rows[index];
        if (!subject || !row) return;
        editValues[subject.id] = {
          code: subject.code,
          nameFr: subject.nameFr,
          nameAr: subject.nameAr ?? '',
          categoryId: subject.categoryId ?? '',
          description: subject.description ?? '',
          isLanguage: subject.isLanguage ? 'true' : '',
          active: subject.active ? 'true' : '',
        };
      });
    }

    const viewRows: SubjectRowView[] = rows.map((row) => ({
      id: row.id,
      code: row.code,
      nameFr: row.nameFr,
      nameAr: row.nameAr ?? '',
      categoryLabel: row.category ? localisedName(row.category, locale) : '',
      isLanguage: row.isLanguage,
      active: row.active,
      groupsCount: row._count.groups,
      teachingAssignmentsCount: row._count.teachingAssignments,
    }));

    state = {
      tab,
      rows: viewRows,
      editValues,
      pagination,
      query: { q: query.q, sort: query.sort, dir: query.dir, pageSize: query.pageSize },
      filters: { active: query.filter.active, stage: query.filter.stage },
    };
  }

  // The category select belongs to the subject form, so it is only fetched when
  // somebody can actually open one.
  const categoryOptions: CategoryOptionView[] =
    canManage && tab !== 'levels'
      ? (await listSubjectCategories(centerId)).map((category) => ({
          id: category.id,
          label: localisedName(category, locale),
        }))
      : [];

  const stageLabels = Object.fromEntries(
    ACADEMIC_STAGES.map((value) => [value, t(`common.stageValues.${value}`)]),
  ) as ValueLabels;

  const labels: AcademicsLabels = {
    title: t('academics.title'),
    subtitle: t('academics.subtitle'),
    tabs: {
      levels: t('academics.tabs.levels'),
      subjects: t('academics.tabs.subjects'),
      languages: t('academics.tabs.languages'),
    },
    levels: t('academics.levels'),
    subjects: t('academics.subjects'),
    languages: t('academics.languages'),
    // The two tabs share one column header each; they are the same wording.
    code: tab === 'levels' ? t('level.code') : t('subject.code'),
    newLevel: t('academics.newLevel'),
    editLevel: t('academics.editLevel'),
    newSubject: t('academics.newSubject'),
    editSubject: t('academics.editSubject'),
    newLanguage: t('academics.newLanguage'),
    editLanguage: t('academics.editLanguage'),
    levelNameFr: t('level.nameFr'),
    levelNameAr: t('level.nameAr'),
    levelStage: t('level.stage'),
    levelSortOrder: t('level.sortOrder'),
    levelStudents: t('level.students'),
    levelGroups: t('level.groups'),
    levelActive: t('level.active'),
    subjectNameFr: t('subject.nameFr'),
    subjectNameAr: t('subject.nameAr'),
    subjectCategory: t('subject.category'),
    subjectIsLanguage: t('subject.isLanguage'),
    subjectDescription: t('subject.description'),
    subjectGroups: t('subject.groups'),
    subjectTeachers: t('subject.teachers'),
    subjectActive: t('subject.active'),
    // Shared chrome.
    search: t('common.search'),
    searchPlaceholder: t('common.searchPlaceholder'),
    searchAction: t('common.filter'),
    reset: t('common.reset'),
    all: t('common.all'),
    noResults: t('common.noResults'),
    noData: t('common.noData'),
    status: t('common.status'),
    actions: t('common.actions'),
    edit: t('common.edit'),
    delete: t('common.delete'),
    restore: t('common.restore'),
    create: t('common.create'),
    save: t('common.save'),
    cancel: t('common.cancel'),
    confirm: t('common.confirm'),
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
  };

  return (
    <>
      <PageHeader title={t('academics.title')} description={t('academics.subtitle')} />
      <AcademicsView
        state={state}
        stageLabels={stageLabels}
        categoryOptions={categoryOptions}
        labels={labels}
        canManage={canManage}
      />
    </>
  );
}