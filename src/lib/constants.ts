/**
 * Domain constants and closed value sets.
 *
 * SQLite has no native enum support in Prisma, so every "enum" in the schema is
 * a string column constrained by TypeScript unions, Zod schemas and the CHECK
 * constraints generated in migrations. This module is the single source of truth.
 */

// --- Roles ------------------------------------------------------------------

export const ROLES = ['ADMIN', 'DIRECTEUR', 'SECRETARY', 'TEACHER'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, { fr: string; ar: string }> = {
  ADMIN: { fr: 'Administrateur', ar: 'مدير النظام' },
  DIRECTEUR: { fr: 'Directeur', ar: 'المدير' },
  SECRETARY: { fr: 'Secrétaire', ar: 'الأمين' },
  TEACHER: { fr: 'Enseignant', ar: 'أستاذ' },
};

// --- Permissions ------------------------------------------------------------

export const PERMISSIONS = [
  'dashboard.view',

  'students.view',
  'students.create',
  'students.update',
  'students.delete',
  'students.import',

  'parents.view',
  'parents.create',
  'parents.update',
  'parents.delete',

  'teachers.view',
  'teachers.create',
  'teachers.update',
  'teachers.delete',

  'academics.view',
  'academics.manage',

  'groups.view',
  'groups.create',
  'groups.update',
  'groups.delete',

  'registrations.view',
  'registrations.create',
  'registrations.update',
  'registrations.delete',

  'schedules.view',
  'schedules.manage',

  'attendance.view',
  'attendance.record',

  'finance.view',
  'finance.payments',
  'finance.refunds',
  'finance.expenses',
  'finance.cashregister',
  'finance.reports',

  'training.view',
  'training.manage',

  'evaluation.view',
  'evaluation.manage',

  'documents.view',
  'documents.manage',

  'reports.view',

  'notifications.view',
  'notifications.manage',

  'users.view',
  'users.manage',

  'settings.view',
  'settings.manage',

  'backups.view',
  'backups.manage',

  'audit.view',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Default role -> permission matrix. ADMIN always receives every permission at
 * runtime (see `hasPermission`), this table documents the intended baseline.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  DIRECTEUR: [
    'dashboard.view',
    'students.view',
    'parents.view',
    'teachers.view',
    'teachers.create',
    'teachers.update',
    'academics.view',
    'academics.manage',
    'groups.view',
    'groups.create',
    'groups.update',
    'registrations.view',
    'schedules.view',
    'schedules.manage',
    'attendance.view',
    'attendance.record',
    'finance.view',
    'finance.reports',
    'training.view',
    'training.manage',
    'evaluation.view',
    'evaluation.manage',
    'documents.view',
    'documents.manage',
    'reports.view',
    'notifications.view',
    'users.view',
    'settings.view',
    'backups.view',
    'audit.view',
  ],
  SECRETARY: [
    'dashboard.view',
    'students.view',
    'students.create',
    'students.update',
    'students.import',
    'parents.view',
    'parents.create',
    'parents.update',
    'teachers.view',
    'academics.view',
    'groups.view',
    'registrations.view',
    'registrations.create',
    'registrations.update',
    'schedules.view',
    'attendance.view',
    'attendance.record',
    'finance.view',
    'finance.payments',
    'finance.expenses',
    'training.view',
    'evaluation.view',
    'documents.view',
    'documents.manage',
    'reports.view',
    'notifications.view',
  ],
  TEACHER: [
    'dashboard.view',
    'students.view',
    'academics.view',
    'groups.view',
    'schedules.view',
    'attendance.view',
    'attendance.record',
    'evaluation.view',
    'evaluation.manage',
    'training.view',
    'documents.view',
  ],
};

// --- Academic ---------------------------------------------------------------

export const ACADEMIC_STAGES = ['PRIMAIRE', 'COLLEGE', 'LYCEE', 'UNIVERSITE'] as const;
export type AcademicStage = (typeof ACADEMIC_STAGES)[number];

export const ACADEMIC_STAGE_LABELS: Record<AcademicStage, { fr: string; ar: string }> = {
  PRIMAIRE: { fr: 'Primaire', ar: 'ابتدائي' },
  COLLEGE: { fr: 'Collège', ar: 'إعدادي' },
  LYCEE: { fr: 'Lycée', ar: 'ثانوي' },
  UNIVERSITE: { fr: 'Universitaire', ar: 'جامعي' },
};

export const STUDENT_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'GRADUATED',
  'LEFT',
] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export const STUDENT_STATUS_LABELS: Record<StudentStatus, { fr: string; ar: string }> = {
  ACTIVE: { fr: 'Actif', ar: 'نشط' },
  INACTIVE: { fr: 'Inactif', ar: 'غير نشط' },
  SUSPENDED: { fr: 'Suspendu', ar: 'موقوف' },
  GRADUATED: { fr: 'Diplômé', ar: 'متخرج' },
  LEFT: { fr: 'Parti', ar: 'مغادر' },
};

export const GENDERS = ['M', 'F'] as const;
export type Gender = (typeof GENDERS)[number];

export const TEACHER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type TeacherStatus = (typeof TEACHER_STATUSES)[number];

// --- Finance ----------------------------------------------------------------

export const PAYMENT_METHOD_CODES = [
  'CASH',
  'BANK_TRANSFER',
  'CHEQUE',
  'CARD',
  'OTHER',
] as const;
export type PaymentMethodCode = (typeof PAYMENT_METHOD_CODES)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodCode, { fr: string; ar: string }> = {
  CASH: { fr: 'Espèces', ar: 'نقدا' },
  BANK_TRANSFER: { fr: 'Virement bancaire', ar: 'تحويل بنكي' },
  CHEQUE: { fr: 'Chèque', ar: 'شيك' },
  CARD: { fr: 'Carte bancaire', ar: 'بطاقة بنكية' },
  OTHER: { fr: 'Autre', ar: 'أخرى' },
};

export const PAYMENT_KINDS = ['PAYMENT', 'REFUND', 'ADVANCE'] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const REGISTRATION_STATUSES = [
  'ACTIVE',
  'PENDING',
  'COMPLETED',
  'CANCELLED',
] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const BILLING_TYPES = ['ONE_TIME', 'MONTHLY', 'SESSION', 'INSTALLMENT'] as const;
export type BillingType = (typeof BILLING_TYPES)[number];

export const MONTHLY_FEE_STATUSES = ['PAID', 'PARTIAL', 'UNPAID', 'OVERDUE'] as const;
export type MonthlyFeeStatus = (typeof MONTHLY_FEE_STATUSES)[number];

export const INVOICE_STATUSES = [
  'DRAFT',
  'ISSUED',
  'PARTIALLY_PAID',
  'PAID',
  'CANCELLED',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PROMOTION_TYPES = ['FIXED', 'PERCENTAGE'] as const;
export type PromotionType = (typeof PROMOTION_TYPES)[number];

export const CASH_TRANSACTION_KINDS = [
  'SALE',
  'REFUND',
  'EXPENSE',
  'OPENING',
  'CLOSING_ADJUSTMENT',
] as const;
export type CashTransactionKind = (typeof CASH_TRANSACTION_KINDS)[number];

export const CASH_REGISTER_STATUSES = ['OPEN', 'CLOSED'] as const;
export type CashRegisterStatus = (typeof CASH_REGISTER_STATUSES)[number];

// --- Attendance -------------------------------------------------------------

export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, { fr: string; ar: string }> = {
  PRESENT: { fr: 'Présent', ar: 'حاضر' },
  ABSENT: { fr: 'Absent', ar: 'غائب' },
  LATE: { fr: 'Retard', ar: 'متأخر' },
  EXCUSED: { fr: 'Excusé', ar: 'بعذر' },
};

export const SESSION_STATUSES = ['PLANNED', 'DONE', 'CANCELLED'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

// --- Training ---------------------------------------------------------------

export const TRAINING_CATEGORIES = [
  'PEDAGOGIQUE',
  'ARTISTIQUE',
  'PROFESSIONNELLE',
  'RELIGIEUSE',
] as const;
export type TrainingCategory = (typeof TRAINING_CATEGORIES)[number];

export const TRAINING_CATEGORY_LABELS: Record<TrainingCategory, { fr: string; ar: string }> = {
  PEDAGOGIQUE: { fr: 'Pédagogique', ar: 'تربوية' },
  ARTISTIQUE: { fr: 'Artistique', ar: 'فنية' },
  PROFESSIONNELLE: { fr: 'Professionnelle', ar: 'مهنية' },
  RELIGIEUSE: { fr: 'Religieuse', ar: 'دينية' },
};

export const TRAINING_STATUSES = ['PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED'] as const;
export type TrainingStatus = (typeof TRAINING_STATUSES)[number];

export const TRAINING_PARTICIPANT_STATUSES = [
  'REGISTERED',
  'IN_PROGRESS',
  'COMPLETED',
  'DROPPED',
] as const;
export type TrainingParticipantStatus = (typeof TRAINING_PARTICIPANT_STATUSES)[number];

// --- Evaluation -------------------------------------------------------------

export const EXAM_TYPES = ['CONTROL', 'MIDTERM', 'FINAL', 'MOCK', 'NATIONAL'] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

export const CERTIFICATE_TYPES = ['PARTICIPATION', 'FORMATION', 'SUCCESS', 'ATTESTATION'] as const;
export type CertificateType = (typeof CERTIFICATE_TYPES)[number];

export const CERTIFICATE_TYPE_LABELS: Record<CertificateType, { fr: string; ar: string }> = {
  PARTICIPATION: { fr: 'Attestation de participation', ar: 'شهادة مشاركة' },
  FORMATION: { fr: 'Attestation de formation', ar: 'شهادة تكوين' },
  SUCCESS: { fr: 'Attestation de réussite', ar: 'شهادة نجاح' },
  ATTESTATION: { fr: 'Attestation de scolarité', ar: 'شهادة التمدرس' },
};

// --- Rooms ------------------------------------------------------------------

export const ROOM_STATUSES = ['AVAILABLE', 'MAINTENANCE', 'CLOSED'] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

// --- Documents --------------------------------------------------------------

export const DOCUMENT_CATEGORIES = [
  'CIN',
  'CERTIFICATE',
  'CONTRACT',
  'SCHOOL',
  'PHOTO',
  'PAYMENT_RECEIPT',
  'OTHER',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

// --- Notifications ----------------------------------------------------------

export const NOTIFICATION_TYPES = [
  'PAYMENT_REMINDER',
  'ABSENCE',
  'SCHEDULE_CHANGE',
  'REGISTRATION',
  'ANNOUNCEMENT',
  'CERTIFICATE',
  'SYSTEM',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_SEVERITIES = ['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'] as const;
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

// --- Audit ------------------------------------------------------------------

export const AUDIT_ACTIONS = [
  'LOGIN',
  'LOGIN_FAILED',
  'LOGOUT',
  'CREATE',
  'UPDATE',
  'DELETE',
  'PAYMENT',
  'REFUND',
  'PERMISSION_CHANGE',
  'SETTINGS_CHANGE',
  'PASSWORD_CHANGE',
  'BACKUP',
  'RESTORE',
  'EXPORT',
  'IMPORT',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// --- Localisation -----------------------------------------------------------

export const LOCALES = ['fr', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'fr';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export const CURRENCY = 'MAD';
export const CURRENCY_SUFFIX = { fr: 'DH', ar: 'د.م.' } as const;
export const DATE_FORMAT = 'DD/MM/YYYY';
