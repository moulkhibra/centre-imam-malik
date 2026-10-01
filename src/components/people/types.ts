/**
 * Shapes exchanged between the Server Components (which own the database) and
 * the Client Components (which own the modals).
 *
 * Everything here is plain JSON: dates are already formatted by the server and
 * permissions are already reduced to booleans, so no Client Component ever has
 * to import a query, a session helper or a formatting helper.
 */

// --- Rows ---------------------------------------------------------------------

/** One student as the table needs it, with everything already localised. */
export type StudentRowView = {
  id: string;
  code: string;
  /** Latin script: the schema forbids anything else, so it is always sortable. */
  firstName: string;
  lastName: string;
  /** "Prénom Nom" in Arabic script, empty when the record has none. */
  nameAr: string;
  cin: string;
  phone: string;
  city: string;
  status: string;
  /** DD/MM/YYYY, empty when unknown. */
  birthDate: string;
  levelName: string;
  parentsCount: number;
};

export type ParentRowView = {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  cin: string;
  phone: string;
  city: string;
  studentsCount: number;
};

// --- Form payloads ------------------------------------------------------------

/** Every field the Zod schema knows about, flattened to strings for the inputs. */
export type StudentFormValues = {
  code: string;
  firstName: string;
  lastName: string;
  firstNameAr: string;
  lastNameAr: string;
  birthDate: string;
  gender: string;
  cin: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  school: string;
  levelId: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  notes: string;
  status: string;
};

export type ParentFormValues = {
  code: string;
  firstName: string;
  lastName: string;
  cin: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  relation: string;
  notes: string;
};

// --- Options and labels -------------------------------------------------------

export type LevelOptionView = {
  id: string;
  label: string;
};

/** Maps a closed value set to its translated label, e.g. ACTIVE -> "Actif". */
export type ValueLabels = Record<string, string>;

/**
 * Every string the Client Components display.
 *
 * The translator runs on the server and only the resolved strings cross the
 * boundary, which is what keeps `@/lib/i18n` (and its dictionary import) out
 * of the client bundle.
 */
export type PeopleLabels = {
  // list chrome
  /** Screen title, used as the table caption. */
  title: string;
  search: string;
  reset: string;
  all: string;
  /** The "no value" option of an optional select, as opposed to `all`. */
  none: string;
  noResults: string;
  empty: string;
  emptySearch: string;
  subtitle: string;
  // columns
  code: string;
  firstName: string;
  lastName: string;
  cin: string;
  phone: string;
  city: string;
  status: string;
  gender: string;
  level: string;
  birthDate: string;
  linkedParents: string;
  linkedStudents: string;
  actions: string;
  // actions
  new: string;
  edit: string;
  delete: string;
  create: string;
  save: string;
  cancel: string;
  confirm: string;
  optional: string;
  // form
  firstNameAr: string;
  lastNameAr: string;
  whatsapp: string;
  email: string;
  address: string;
  school: string;
  emergencyContact: string;
  notes: string;
  relation: string;
  // delete confirmation
  deleteConfirm: string;
  deleteConfirmHint: string;
  // feedback
  created: string;
  updated: string;
  deleted: string;
  error: string;
  loading: string;
  // pagination
  previous: string;
  next: string;
  page: string;
  of: string;
  /** Whole sentence with `{from}` / `{to}` / `{total}`; the view interpolates. */
  showing: string;
};

export type FieldErrorMap = Record<string, string[] | undefined>;
