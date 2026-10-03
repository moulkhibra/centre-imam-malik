import type { PageInfo, SortDirection } from '@/lib/lists';
import type { PeopleLabels } from '@/components/people/types';

/**
 * Shapes exchanged between the catalogue Server Components (which own the
 * database) and the catalogue Client Components (which own the modals).
 *
 * Same contract as `@/components/people/types`: everything here is plain JSON,
 * dates and money are already formatted by the server, permissions are already
 * reduced to booleans, so no Client Component ever imports a query, a session
 * helper or the translator.
 *
 * `FieldErrorMap` and `ValueLabels` are reused from the people screens rather
 * than redeclared - the two surfaces draw exactly the same way.
 */

export type { FieldErrorMap, ValueLabels } from '@/components/people/types';

/** What the URL is allowed to say, once the server has validated it. */
export type AcademicsTab = 'levels' | 'subjects' | 'languages';

// --- List plumbing ----------------------------------------------------------

/** The subset of a parsed list query the views need, kept URL-shaped. */
export type CatalogListState = {
  q: string;
  sort: string;
  dir: SortDirection;
  pageSize: number;
};

/** The two filters every catalogue screen shares. */
export type CatalogFilterState = {
  active: string;
  stage: string;
};

// --- Rows --------------------------------------------------------------------

export type LevelRowView = {
  id: string;
  code: string;
  nameFr: string;
  /** Arabic name, empty when the record has none. */
  nameAr: string;
  stage: string;
  sortOrder: number;
  active: boolean;
  studentsCount: number;
  groupsCount: number;
};

export type SubjectRowView = {
  id: string;
  code: string;
  nameFr: string;
  nameAr: string;
  /** Already localised by the server, empty when uncategorised. */
  categoryLabel: string;
  isLanguage: boolean;
  active: boolean;
  groupsCount: number;
  teachingAssignmentsCount: number;
};

export type ServiceRowView = {
  id: string;
  code: string;
  nameFr: string;
  nameAr: string;
  /** Already rendered by `formatMad` in the user's locale. */
  price: string;
  durationMinutes: number;
  active: boolean;
};

export type RoomRowView = {
  id: string;
  name: string;
  capacity: number;
  location: string;
  equipment: string;
  status: string;
  active: boolean;
  groupsCount: number;
  schedulesCount: number;
};

// --- Form payloads -----------------------------------------------------------

/**
 * Every field the Zod schema knows about, flattened to strings for the inputs.
 *
 * Booleans travel as `'true'` / `''` because that is exactly what an unchecked
 * checkbox paired with a hidden `value=""` submits, and what
 * `z.coerce.boolean()` reads back.
 */
export type LevelFormValues = {
  code: string;
  stage: string;
  nameFr: string;
  nameAr: string;
  sortOrder: string;
  active: string;
};

export type SubjectFormValues = {
  code: string;
  nameFr: string;
  nameAr: string;
  categoryId: string;
  description: string;
  isLanguage: string;
  active: string;
};

export type ServiceFormValues = {
  code: string;
  nameFr: string;
  nameAr: string;
  description: string;
  /** Decimal string such as `"250.50"` - never cents. */
  price: string;
  durationMinutes: string;
  active: string;
};

export type RoomFormValues = {
  name: string;
  capacity: string;
  location: string;
  equipment: string;
  status: string;
  notes: string;
  active: string;
};

// --- Options ----------------------------------------------------------------

/** Category of the subject select, already localised by the server. */
export type CategoryOptionView = {
  id: string;
  label: string;
};

// --- Labels -----------------------------------------------------------------

/**
 * The strings every catalogue screen shares.
 *
 * Built on top of `PeopleLabels` - the same way `TeacherForm` extends it - so
 * the catalogue and the people screens cannot drift apart on wording.
 */
export type CatalogLabels = Pick<
  PeopleLabels,
  | 'title'
  | 'search'
  | 'reset'
  | 'all'
  | 'noResults'
  | 'code'
  | 'status'
  | 'actions'
  | 'edit'
  | 'delete'
  | 'create'
  | 'save'
  | 'cancel'
  | 'confirm'
  | 'optional'
  | 'deleteConfirm'
  | 'deleteConfirmHint'
  | 'created'
  | 'updated'
  | 'deleted'
  | 'error'
  | 'loading'
  | 'previous'
  | 'next'
  | 'page'
  | 'of'
  | 'showing'
> & {
  /** Badge label of an active row. */
  active: string;
  /** Badge label of a deactivated row. */
  inactive: string;
  /** Button that reactivates a deactivated row. */
  restore: string;
  /** Notice shown when a delete could only deactivate the record. */
  deactivated: string;
  /** Description of the "this catalogue has no row yet" state. */
  noData: string;
};

/** Column and form labels of the three academics tabs, all in one flat bag. */
export type AcademicsLabels = CatalogLabels & {
  subtitle: string;
  tabs: { levels: string; subjects: string; languages: string };
  levels: string;
  subjects: string;
  languages: string;
  newLevel: string;
  editLevel: string;
  newSubject: string;
  editSubject: string;
  newLanguage: string;
  editLanguage: string;
  levelNameFr: string;
  levelNameAr: string;
  levelStage: string;
  levelSortOrder: string;
  levelStudents: string;
  levelGroups: string;
  levelActive: string;
  subjectNameFr: string;
  subjectNameAr: string;
  subjectCategory: string;
  subjectIsLanguage: string;
  subjectDescription: string;
  subjectGroups: string;
  subjectTeachers: string;
  subjectActive: string;
};

export type ServiceLabels = CatalogLabels & {
  /**
   * The toolbar button that opens the create dialog.
   *
   * Deliberately distinct from `create`: `create` is the dialog's submit button
   * ("Créer"), and labelling both "Nouveau service" gave the dialog a title and a
   * submit button reading the same thing, and left the submit button with no verb.
   */
  newService: string;
  nameFr: string;
  nameAr: string;
  description: string;
  price: string;
  duration: string;
  serviceActive: string;
};

/**
 * A room is identified by its name only: the schema has no `code` column, so
 * unlike levels, subjects and services there is nothing for the header to show.
 * `code` is dropped rather than filled with a dummy translation, which would
 * also force every caller to invent a string it never renders.
 */
export type RoomLabels = Omit<CatalogLabels, 'code'> & {
  /** The toolbar button that opens the create dialog; see `ServiceLabels.newService`. */
  newRoom: string;
  name: string;
  capacity: string;
  location: string;
  equipment: string;
  notes: string;
  groups: string;
  schedules: string;
  roomActive: string;
};

// --- Tab state --------------------------------------------------------------

/**
 * One tab of the academics screen, discriminated by `tab`.
 *
 * Only the active tab is fetched, so the page never carries the data of the two
 * lists it is not showing.
 */
export type LevelTabState = {
  tab: 'levels';
  rows: LevelRowView[];
  editValues: Record<string, LevelFormValues>;
  pagination: PageInfo;
  query: CatalogListState;
  filters: CatalogFilterState;
};

export type SubjectTabState = {
  tab: 'subjects' | 'languages';
  rows: SubjectRowView[];
  editValues: Record<string, SubjectFormValues>;
  pagination: PageInfo;
  query: CatalogListState;
  filters: CatalogFilterState;
};

export type AcademicsTabState = LevelTabState | SubjectTabState;