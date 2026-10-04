import '@/lib/utils/server-only';
import { cache } from 'react';
import { prisma } from '@/lib/db/client';
import { DEFAULT_LOCALE, type Locale } from '@/lib/constants';
import { DEFAULT_CENTER_SETTINGS } from '@/lib/settings/defaults';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_LEVELS,
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_SERVICES,
  DEFAULT_SUBJECTS,
  DEFAULT_SUBJECT_CATEGORIES,
} from '@/lib/settings/defaults';

export type CenterSettings = {
  id: string;
  code: string;
  nameFr: string;
  nameAr: string | null;
  shortNameFr: string;
  shortNameAr: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  logoPath: string | null;
  primaryColor: string;
  secondaryColor: string;
  currency: string;
  timezone: string;
  locale: Locale;
  receiptFooterFr: string;
  receiptFooterAr: string;
  certificateFooterFr: string;
  certificateFooterAr: string;
  directorNameFr: string;
  directorNameAr: string;
  currentAcademicYearId: string | null;
  currentAcademicYearLabel: string | null;
};

/** Centre is the active one; multi-centre IDs are stored on every record. */
export const ACTIVE_CENTER_CODE = 'CIM';

export const getActiveCenter = cache(async (): Promise<CenterSettings | null> => {
  const center = await prisma.center.findFirst({
    where: { active: true },
    orderBy: { createdAt: 'asc' },
    include: { academicYears: { where: { isCurrent: true }, take: 1 } },
  });
  if (!center) return null;
  return hydrate(center, await getSettingsMap(center.id));
});

type CenterRow = {
  id: string;
  code: string;
  nameFr: string;
  nameAr: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  logoPath: string | null;
  primaryColor: string;
  secondaryColor: string;
  currency: string;
  timezone: string;
  academicYears: { id: string; label: string }[];
};

function hydrate(
  center: CenterRow,
  settings: Map<string, string>,
): CenterSettings {
  const current = center.academicYears[0];
  return {
    id: center.id,
    code: center.code,
    nameFr: center.nameFr,
    nameAr: center.nameAr,
    shortNameFr: settings.get('center.shortNameFr') ?? '',
    shortNameAr: settings.get('center.shortNameAr') ?? '',
    address: center.address,
    city: center.city,
    phone: center.phone,
    whatsapp: center.whatsapp,
    email: center.email,
    website: center.website,
    logoPath: center.logoPath,
    primaryColor: center.primaryColor,
    secondaryColor: center.secondaryColor,
    currency: center.currency,
    timezone: center.timezone,
    locale: (settings.get('center.locale') as Locale | undefined) ?? DEFAULT_LOCALE,
    receiptFooterFr: settings.get('receipt.footerFr') ?? DEFAULT_CENTER_SETTINGS['receipt.footerFr'],
    receiptFooterAr: settings.get('receipt.footerAr') ?? DEFAULT_CENTER_SETTINGS['receipt.footerAr'],
    certificateFooterFr:
      settings.get('certificate.footerFr') ?? DEFAULT_CENTER_SETTINGS['certificate.footerFr'],
    certificateFooterAr:
      settings.get('certificate.footerAr') ?? DEFAULT_CENTER_SETTINGS['certificate.footerAr'],
    directorNameFr:
      settings.get('certificate.directorNameFr') ?? DEFAULT_CENTER_SETTINGS['certificate.directorNameFr'],
    directorNameAr:
      settings.get('certificate.directorNameAr') ?? DEFAULT_CENTER_SETTINGS['certificate.directorNameAr'],
    currentAcademicYearId: current?.id ?? null,
    currentAcademicYearLabel: current?.label ?? null,
  };
}

/**
 * Every field the settings form owns, for one specific centre.
 *
 * Deliberately not `getActiveCenter`: the screen edits `user.centerId`, and
 * reading whichever centre happens to be flagged `active` would show - and then
 * overwrite - a different row the day a second centre is installed. The values
 * are returned as the form needs them (empty string instead of null) because a
 * controlled input cannot hold null.
 */
export type CenterSettingsFormValues = {
  code: string;
  nameFr: string;
  nameAr: string;
  shortNameFr: string;
  shortNameAr: string;
  legalName: string;
  address: string;
  city: string;
  phone: string;
  whatsapp: string;
  email: string;
  facebook: string;
  instagram: string;
  website: string;
  logoPath: string;
  primaryColor: string;
  secondaryColor: string;
  timezone: string;
  locale: Locale;
  receiptFooterFr: string;
  receiptFooterAr: string;
  certificateFooterFr: string;
  certificateFooterAr: string;
  directorNameFr: string;
  directorNameAr: string;
};

export const getCenterSettingsFormValues = cache(
  async (centerId: string): Promise<CenterSettingsFormValues | null> => {
    const center = await prisma.center.findUnique({
      where: { id: centerId },
      select: {
        code: true,
        nameFr: true,
        nameAr: true,
        legalName: true,
        address: true,
        city: true,
        phone: true,
        whatsapp: true,
        email: true,
        facebook: true,
        instagram: true,
        website: true,
        logoPath: true,
        primaryColor: true,
        secondaryColor: true,
        timezone: true,
      },
    });
    if (!center) return null;

    const settings = await getSettingsMap(centerId);
    // A key the centre has never set falls back to the shipped default, and a key
    // the reference data does not know falls back to empty: both mean "nothing to
    // show yet", never an exception while filling a form.
    const value = (key: string) =>
      settings.get(key) ?? (DEFAULT_CENTER_SETTINGS as Record<string, string>)[key] ?? '';

    return {
      code: center.code,
      nameFr: center.nameFr,
      nameAr: center.nameAr ?? '',
      shortNameFr: value('center.shortNameFr'),
      shortNameAr: value('center.shortNameAr'),
      legalName: center.legalName ?? '',
      address: center.address ?? '',
      city: center.city ?? '',
      phone: center.phone ?? '',
      whatsapp: center.whatsapp ?? '',
      email: center.email ?? '',
      facebook: center.facebook ?? '',
      instagram: center.instagram ?? '',
      website: center.website ?? '',
      logoPath: center.logoPath ?? '',
      primaryColor: center.primaryColor,
      secondaryColor: center.secondaryColor,
      timezone: center.timezone,
      locale: (settings.get('center.locale') as Locale | undefined) ?? DEFAULT_LOCALE,
      receiptFooterFr: value('receipt.footerFr'),
      receiptFooterAr: value('receipt.footerAr'),
      certificateFooterFr: value('certificate.footerFr'),
      certificateFooterAr: value('certificate.footerAr'),
      directorNameFr: value('certificate.directorNameFr'),
      directorNameAr: value('certificate.directorNameAr'),
    };
  },
);

export async function getSettingsMap(centerId: string): Promise<Map<string, string>> {
  const rows = await prisma.centerSetting.findMany({ where: { centerId } });
  return new Map(rows.map((r) => [r.key, r.value]));
}

export async function getSetting(centerId: string, key: string, fallback = ''): Promise<string> {
  const row = await prisma.centerSetting.findUnique({ where: { centerId_key: { centerId, key } } });
  if (row) return row.value;
  const known = (DEFAULT_CENTER_SETTINGS as Record<string, string>)[key];
  return known ?? fallback;
}

/**
 * Atomically increments a document-number counter and returns the padded value.
 * Runs inside a transaction so two concurrent payments can never share a
 * receipt number (the unique constraint is the final safety net).
 */
export async function nextDocumentNumber(
  tx: {
    centerSetting: {
      findUnique: (args: { where: { centerId_key: { centerId: string; key: string } } }) => Promise<{ value: string } | null>;
      upsert: (args: unknown) => Promise<unknown>;
    };
  },
  centerId: string,
  key: string,
  options: { prefix?: string; width?: number; year?: number } = {},
): Promise<string> {
  const { prefix = '', width = 5, year } = options;
  const row = await tx.centerSetting.findUnique({ where: { centerId_key: { centerId, key } } });
  const current = Number.parseInt(row?.value ?? '0', 10) || 0;
  const next = current + 1;
  const value = String(next);

  await tx.centerSetting.upsert({
    where: { centerId_key: { centerId, key } },
    create: { centerId, key, value },
    update: { value },
  });

  const period = year ? `-${year}` : '';
  return `${prefix}${period}-${String(next).padStart(width, '0')}`;
}

// --- Reference data installation -------------------------------------------

/**
 * Installs the reference configuration a working system needs:
 * subject categories, subjects, levels, services, payment methods, expense
 * categories, settings and the current academic year.
 *
 * Idempotent: safe to run on every install and re-run after an update.
 * Creates NO demo or business data.
 */
export async function installReferenceData(centerId: string, options: { yearLabel?: string } = {}): Promise<void> {
  const now = new Date();
  const defaultYearStart = new Date(now.getFullYear(), 8, 1);
  const defaultYearEnd = new Date(now.getFullYear() + 1, 7, 31);

  await prisma.$transaction(async (tx) => {
    for (const category of DEFAULT_SUBJECT_CATEGORIES) {
      await tx.subjectCategory.upsert({
        where: { centerId_slug: { centerId, slug: category.slug } },
        create: {
          centerId,
          slug: category.slug,
          nameFr: category.nameFr,
          nameAr: category.nameAr,
          sortOrder: category.sortOrder,
        },
        update: { nameFr: category.nameFr, nameAr: category.nameAr },
      });
    }

    for (const subject of DEFAULT_SUBJECTS) {
      const category = await tx.subjectCategory.findUnique({
        where: { centerId_slug: { centerId, slug: subject.category } },
      });
      await tx.subject.upsert({
        where: { centerId_code: { centerId, code: subject.code } },
        create: {
          centerId,
          code: subject.code,
          nameFr: subject.nameFr,
          nameAr: subject.nameAr,
          categoryId: category?.id ?? null,
          isLanguage: subject.isLanguage ?? false,
        },
        update: { nameFr: subject.nameFr, nameAr: subject.nameAr, categoryId: category?.id ?? null },
      });
    }

    for (const level of DEFAULT_LEVELS) {
      await tx.academicLevel.upsert({
        where: { centerId_code: { centerId, code: level.code } },
        create: {
          centerId,
          code: level.code,
          stage: level.stage,
          stageAr: level.stageAr,
          nameFr: level.nameFr,
          nameAr: level.nameAr,
          sortOrder: level.sortOrder,
        },
        update: { nameFr: level.nameFr, nameAr: level.nameAr, sortOrder: level.sortOrder },
      });
    }

    for (const service of DEFAULT_SERVICES) {
      await tx.service.upsert({
        where: { centerId_code: { centerId, code: service.code } },
        create: {
          centerId,
          code: service.code,
          nameFr: service.nameFr,
          nameAr: service.nameAr,
          description: service.descriptionFr,
        },
        update: { nameFr: service.nameFr, nameAr: service.nameAr, description: service.descriptionFr },
      });
    }

    for (const method of DEFAULT_PAYMENT_METHODS) {
      await tx.paymentMethod.upsert({
        where: { centerId_code: { centerId, code: method.code } },
        create: { centerId, code: method.code, nameFr: method.nameFr, nameAr: method.nameAr, sortOrder: method.sortOrder },
        update: { nameFr: method.nameFr, nameAr: method.nameAr, sortOrder: method.sortOrder },
      });
    }

    for (const category of DEFAULT_EXPENSE_CATEGORIES) {
      await tx.expenseCategory.upsert({
        where: { centerId_code: { centerId, code: category.code } },
        create: { centerId, code: category.code, nameFr: category.nameFr, nameAr: category.nameAr },
        update: { nameFr: category.nameFr, nameAr: category.nameAr },
      });
    }

    for (const [key, value] of Object.entries(DEFAULT_CENTER_SETTINGS)) {
      await tx.centerSetting.upsert({
        where: { centerId_key: { centerId, key } },
        create: { centerId, key, value },
        update: {},
      });
    }
  });

  // Current academic year (Moroccan school year: 1 September -> 31 August)
  const yearLabel = options.yearLabel ?? computeAcademicYearLabel(now);
  const existing = await prisma.academicYear.findUnique({
    where: { centerId_label: { centerId, label: yearLabel } },
  });
  if (!existing) {
    await prisma.academicYear.create({
      data: {
        centerId,
        label: yearLabel,
        startDate: defaultYearStart,
        endDate: defaultYearEnd,
        isCurrent: true,
      },
    });
  } else if (!existing.isCurrent) {
    await prisma.$transaction([
      prisma.academicYear.updateMany({ where: { centerId, isCurrent: true }, data: { isCurrent: false } }),
      prisma.academicYear.update({ where: { id: existing.id }, data: { isCurrent: true } }),
    ]);
  }
}

/** September 2026 -> "2026/2027" */
export function computeAcademicYearLabel(date: Date): string {
  const year = date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1;
  return `${year}/${year + 1}`;
}
