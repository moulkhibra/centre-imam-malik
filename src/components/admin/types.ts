/**
 * Shapes exchanged between the Server Components (which own the database) and
 * the Client Components (which own the modals) of the accounts screen.
 *
 * Same rule as the people screens: everything here is plain JSON and already
 * resolved. No Client Component imports a query, a session helper, a permission
 * matrix or a dictionary - the server decides what the reader may see, including
 * which actions exist at all.
 */

/** One account as the table needs it. */
export type UserRowView = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  /** DD/MM/YYYY, empty when the account has never signed in. */
  lastLoginAt: string;
  /** DD/MM/YYYY, always set: an account has a creation date. */
  createdAt: string;
  /** The linked catalogue teacher, already formatted for the reader. */
  teacherLabel: string;
  teacherCode: string;
  /**
   * True when the row is the account of the reader.
   *
   * Passed down rather than compared in the browser: the caller knows who it is,
   * and the comparison decides whether the deactivate button may exist at all.
   */
  isSelf: boolean;
  /**
   * False for the last active administrator, whose row must not offer a
   * deactivate or a demotion. The server refuses both anyway.
   */
  canDeactivate: boolean;
  /**
   * Effective permissions, resolved on the server: `null` means "the whole
   * catalogue" (an ADMIN), which is displayed as one sentence instead of fifty
   * rows.
   */
  permissions: string[] | null;
};

/** Every field the account schema knows about, flattened for the inputs. */
export type UserFormValues = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  teacherId: string;
  locale: string;
};

/** The create form has one field the update form does not: the initial password. */
export type UserCreateValues = UserFormValues & { password: string };

/** One catalogue teacher a TEACHER account may be linked to. */
export type TeacherOptionView = {
  id: string;
  label: string;
  /** Empty when no account claims this teacher yet. */
  takenBy: string;
  /** True when the teacher is already linked to the account being edited. */
  isCurrent: boolean;
};

/** Maps a closed value set to its translated label, e.g. ROLE -> "Secrétaire". */
export type ValueLabels = Record<string, string>;

/**
 * Every string the accounts screen displays.
 *
 * `PeopleLabels` covers the shared chrome (search, pagination, feedback) so the
 * two screens cannot drift on a button label; the account-specific keys sit on
 * top in `UserLabels`.
 */
export type UsersViewLabels = {
  // shared chrome
  search: string;
  searchPlaceholder: string;
  searchAction: string;
  reset: string;
  all: string;
  none: string;
  noResults: string;
  previous: string;
  next: string;
  page: string;
  of: string;
  showing: string;
  create: string;
  save: string;
  cancel: string;
  optional: string;
  error: string;
  loading: string;
  // columns and filters
  title: string;
  subtitle: string;
  name: string;
  email: string;
  role: string;
  status: string;
  teacher: string;
  lastLogin: string;
  actions: string;
  // forms
  new: string;
  edit: string;
  phone: string;
  /**
   * Two fields, two labels.
   *
   * Both name inputs once carried `common.name` ("Nom"), which made the identity
   * form announce two identical required fields and put the message for one of
   * them under whichever came first.
   */
  firstName: string;
  lastName: string;
  language: string;
  initialPassword: string;
  initialPasswordHint: string;
  resetPassword: string;
  resetPasswordTitle: string;
  resetPasswordHint: string;
  newPassword: string;
  confirmPassword: string;
  // states
  accountActive: string;
  accountInactive: string;
  temporaryPassword: string;
  neverLoggedIn: string;
  teacherHint: string;
  noTeacher: string;
  noTeachers: string;
  teachersPartlyTaken: string;
  permissions: string;
  rolePermissions: string;
  extraPermissions: string;
  noExtraPermissions: string;
  allPermissions: string;
  // actions
  deactivate: string;
  activate: string;
  deactivateConfirm: string;
  deactivateConfirmHint: string;
  activateConfirm: string;
  activateConfirmHint: string;
  confirm: string;
  // feedback
  created: string;
  updated: string;
  deactivated: string;
  activated: string;
  passwordResetDone: string;
  // empty states
  empty: string;
  emptySearch: string;
};

export type FieldErrorMap = Record<string, string[] | undefined>;