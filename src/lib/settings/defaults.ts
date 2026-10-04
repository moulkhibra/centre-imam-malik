import { LOCALES, ROLES, PAYMENT_METHOD_CODES, type Locale, type Role } from '@/lib/constants';

export type DefaultSubject = {
  code: string;
  nameFr: string;
  nameAr: string;
  category: string;
  isLanguage?: boolean;
};

export type DefaultLevel = {
  code: string;
  stage: string;
  stageAr: string;
  nameFr: string;
  nameAr: string;
  sortOrder: number;
};

export type DefaultService = {
  code: string;
  nameFr: string;
  nameAr: string;
  descriptionFr: string;
  descriptionAr: string;
};

/**
 * Default academic configuration shipped with every installation.
 * These are REFERENCE data required for the application to function, not demo
 * content: a fresh production install contains exactly these rows and nothing
 * else (no students, teachers, payments or financial records).
 */

export const DEFAULT_SUBJECT_CATEGORIES = [
  { slug: 'MATHEMATIQUES', nameFr: 'Mathématiques', nameAr: 'الرياضيات', sortOrder: 1 },
  { slug: 'SCIENCES', nameFr: 'Sciences physiques', nameAr: 'العلوم الفيزيائية', sortOrder: 2 },
  { slug: 'SVT', nameFr: 'Sciences de la vie et de la terre', nameAr: 'علوم الحياة والأرض', sortOrder: 3 },
  { slug: 'LANGUES', nameFr: 'Langues', nameAr: 'اللغات', sortOrder: 4 },
  { slug: 'LITTERAIRE', nameFr: 'Disciplines littéraires', nameAr: 'المواد الأدبية', sortOrder: 5 },
  { slug: 'PHILOSOPHIE', nameFr: 'Philosophie', nameAr: 'الفلسفة', sortOrder: 6 },
  { slug: 'INFORMATIQUE', nameFr: 'Informatique', nameAr: 'المعلوميات', sortOrder: 7 },
  { slug: 'AUTRES', nameFr: 'Autres matières', nameAr: 'مواد أخرى', sortOrder: 8 },
] as const;

export const DEFAULT_SUBJECTS: readonly DefaultSubject[] = [
  { code: 'MATH', nameFr: 'Mathématiques', nameAr: 'الرياضيات', category: 'MATHEMATIQUES' },
  { code: 'PHYS', nameFr: 'Physique', nameAr: 'الفيزياء', category: 'SCIENCES' },
  { code: 'CHIM', nameFr: 'Chimie', nameAr: 'الكيمياء', category: 'SCIENCES' },
  { code: 'SVT', nameFr: 'SVT', nameAr: 'علوم الحياة والأرض', category: 'SVT' },
  { code: 'ARABE', nameFr: 'Arabe', nameAr: 'اللغة العربية', category: 'LITTERAIRE' },
  { code: 'FRANCAIS', nameFr: 'Français', nameAr: 'اللغة الفرنسية', category: 'LANGUES', isLanguage: true },
  { code: 'ANGLAIS', nameFr: 'Anglais', nameAr: 'اللغة الإنجليزية', category: 'LANGUES', isLanguage: true },
  { code: 'ALLEMAND', nameFr: 'Allemand', nameAr: 'اللغة الألمانية', category: 'LANGUES', isLanguage: true },
  { code: 'ESPAGNOL', nameFr: 'Espagnol', nameAr: 'اللغة الإسبانية', category: 'LANGUES', isLanguage: true },
  { code: 'ITALIEN', nameFr: 'Italien', nameAr: 'اللغة الإيطالية', category: 'LANGUES', isLanguage: true },
  { code: 'PHILO', nameFr: 'Philosophie', nameAr: 'الفلسفة', category: 'PHILOSOPHIE' },
  { code: 'INFO', nameFr: 'Informatique', nameAr: 'المعلوميات', category: 'INFORMATIQUE' },
  { code: 'HIST', nameFr: 'Histoire-Géographie', nameAr: 'التاريخ والجغرافيا', category: 'LITTERAIRE' },
  { code: 'EPS', nameFr: 'Éducation physique', nameAr: 'التربية الرياضية', category: 'AUTRES' },
] as const;

/**
 * Levels required by the Moroccan system.
 * `UNIVERSITE` is left empty on purpose: the specification states that
 * university levels are configurable, so the administrator creates them.
 */
export const DEFAULT_LEVELS: readonly DefaultLevel[] = [
  { code: 'PRIM_1', stage: 'PRIMAIRE', stageAr: 'ابتدائي', nameFr: '1ère année primaire', nameAr: 'السنة الأولى ابتدائي', sortOrder: 10 },
  { code: 'PRIM_2', stage: 'PRIMAIRE', stageAr: 'ابتدائي', nameFr: '2ème année primaire', nameAr: 'السنة الثانية ابتدائي', sortOrder: 20 },
  { code: 'PRIM_3', stage: 'PRIMAIRE', stageAr: 'ابتدائي', nameFr: '3ème année primaire', nameAr: 'السنة الثالثة ابتدائي', sortOrder: 30 },
  { code: 'PRIM_4', stage: 'PRIMAIRE', stageAr: 'ابتدائي', nameFr: '4ème année primaire', nameAr: 'السنة الرابعة ابتدائي', sortOrder: 40 },
  { code: 'PRIM_5', stage: 'PRIMAIRE', stageAr: 'ابتدائي', nameFr: '5ème année primaire', nameAr: 'السنة الخامسة ابتدائي', sortOrder: 50 },
  { code: 'PRIM_6', stage: 'PRIMAIRE', stageAr: 'ابتدائي', nameFr: '6ème année primaire', nameAr: 'السنة السادسة ابتدائي', sortOrder: 60 },
  { code: 'COL_1', stage: 'COLLEGE', stageAr: 'إعدادي', nameFr: '1ère année collège', nameAr: 'السنة الأولى إعدادي', sortOrder: 110 },
  { code: 'COL_2', stage: 'COLLEGE', stageAr: 'إعدادي', nameFr: '2ème année collège', nameAr: 'السنة الثانية إعدادي', sortOrder: 120 },
  { code: 'COL_3', stage: 'COLLEGE', stageAr: 'إعدادي', nameFr: '3ème année collège', nameAr: 'السنة الثالثة إعدادي', sortOrder: 130 },
  { code: 'LYC_TC', stage: 'LYCEE', stageAr: 'ثانوي', nameFr: 'Tronc Commun', nameAr: 'الجذع المشترك', sortOrder: 210 },
  { code: 'LYC_1BAC', stage: 'LYCEE', stageAr: 'ثانوي', nameFr: '1ère Bac', nameAr: 'الأولى باكالوريا', sortOrder: 220 },
  { code: 'LYC_2BAC', stage: 'LYCEE', stageAr: 'ثانوي', nameFr: '2ème Bac', nameAr: 'الثانية باكالوريا', sortOrder: 230 },
] as const;

/**
 * Services are distinct from subjects: orientation, encadrement, accompaniment
 * and exam preparation are centre services, not taught disciplines.
 */
export const DEFAULT_SERVICES: readonly DefaultService[] = [
  {
    code: 'ORIENTATION',
    nameFr: 'Orientation scolaire',
    nameAr: 'التوجيه الدراسي',
    descriptionFr: 'Accompagnement personnalisé dans le choix des études supérieures et professionnelles',
    descriptionAr: 'مرافقة شخصية في اختيار الدراسات العليا والمهنية',
  },
  {
    code: 'ENCADREMENT',
    nameFr: 'Encadrement',
    nameAr: 'تأطير',
    descriptionFr: 'Encadrement, suivi pédagogique et accompagnement des groupes',
    descriptionAr: 'التأطير والمواكبة التربوية والمرافقة',
  },
  {
    code: 'ACCOMPAGNEMENT',
    nameFr: 'Accompagnement scolaire',
    nameAr: 'الدعم الدراسي',
    descriptionFr: 'Accompagnement scolaire individualisé et travail-dirigé',
    descriptionAr: 'دعم دراسي فردي وأشغال موجهة',
  },
  {
    code: 'PREP_EXAMENS',
    nameFr: 'Préparation aux examens',
    nameAr: 'التحضير للامتحانات',
    descriptionFr: 'Préparation intensive aux examens scolaires',
    descriptionAr: 'تحضير مكثف للامتحانات المدرسية',
  },
  {
    code: 'PREP_CERTIFICATIFS',
    nameFr: 'Préparation aux examens certificatifs',
    nameAr: 'التحضير للامتحانات الشهادية',
    descriptionFr: 'Préparation aux examens certificatifs (collège, lycée, université)',
    descriptionAr: 'التحضير للامتحانات الشهادية (إعدادي، ثانوي، جامعي)',
  },
] as const;

export const DEFAULT_EXPENSE_CATEGORIES = [
  { code: 'LOYER', nameFr: 'Loyer', nameAr: 'الكراء' },
  { code: 'SALAIRES', nameFr: 'Salaires', nameAr: 'الأجور' },
  { code: 'FOURNITURES', nameFr: 'Fournitures', nameAr: 'اللوازم' },
  { code: 'ENERGIE', nameFr: 'Eau, électricité, internet', nameAr: 'الماء والكهرباء والإنترنت' },
  { code: 'ENTRETIEN', nameFr: 'Entretien et réparations', nameAr: 'الصيانة والإصلاحات' },
  { code: 'PUBLICITE', nameFr: 'Publicité', nameAr: 'الإشهار' },
  { code: 'TRANSPORT', nameFr: 'Transport', nameAr: 'النقل' },
  { code: 'FOURNISSEURS', nameFr: 'Fournisseurs', nameAr: 'الموردون' },
  { code: 'DIVERS', nameFr: 'Divers', nameAr: 'متنوعات' },
] as const;

export const DEFAULT_PAYMENT_METHODS: readonly {
  code: (typeof PAYMENT_METHOD_CODES)[number];
  nameFr: string;
  nameAr: string;
  sortOrder: number;
}[] = PAYMENT_METHOD_CODES.map((code, index) => {
  const labels: Record<(typeof PAYMENT_METHOD_CODES)[number], { fr: string; ar: string }> = {
    CASH: { fr: 'Espèces', ar: 'نقدا' },
    BANK_TRANSFER: { fr: 'Virement bancaire', ar: 'تحويل بنكي' },
    CHEQUE: { fr: 'Chèque', ar: 'شيك' },
    CARD: { fr: 'Carte bancaire', ar: 'بطاقة بنكية' },
    OTHER: { fr: 'Autre', ar: 'أخرى' },
  };
  return { code, nameFr: labels[code].fr, nameAr: labels[code].ar, sortOrder: index + 1 };
});

/** Settings key/value defaults (branding, receipts, certificates). */
export const DEFAULT_CENTER_SETTINGS = {
  /** Written only by the logo upload; '' means "no uploaded logo". */
  'center.logoFile': '',
  'receipt.footerFr':
    'Merci pour votre confiance. Toute somme versée ne peut être remboursée que sur présentation du présent reçu.',
  'receipt.footerAr': 'شكرا على ثقتكم. لا يمكن استرجاع أي مبلغ بدون تقديم هذه الوصالة.',
  'receipt.prefix': 'REC',
  'receipt.language': 'fr',
  'receipt.showLogo': 'true',
  'certificate.footerFr': 'Délivré par le Centre pour attestation en cours de formation.',
  'certificate.footerAr': 'صادرة عن المركز لتأكيد التكوين.',
  'certificate.prefix': 'ATT',
  'certificate.directorNameFr': 'Le Directeur',
  'certificate.directorNameAr': 'المدير',
  'backup.enabled': 'true',
  'backup.frequency': 'DAILY',
  'backup.retentionDays': '30',
  'backup.destination': '',
  'invoice.prefix': 'FACT',
  'invoice.nextNumber': '1',
  'receipt.nextNumber': '1',
  'certificate.nextNumber': '1',
  'payment.nextNumber': '1',
  'expense.nextNumber': '1',
  'cashRegister.nextNumber': '1',
  'student.nextNumber': '1',
  'parent.nextNumber': '1',
  'teacher.nextNumber': '1',
} as const;

export type CenterSettingKey = keyof typeof DEFAULT_CENTER_SETTINGS;

export const DEFAULT_ROLES: readonly Role[] = ROLES;
export const DEFAULT_LOCALES: readonly Locale[] = LOCALES;
