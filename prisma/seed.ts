import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'node:path';
import { hash } from 'bcryptjs';
import {
  DEFAULT_CENTER_SETTINGS,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_LEVELS,
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_SERVICES,
  DEFAULT_SUBJECTS,
  DEFAULT_SUBJECT_CATEGORIES,
} from '../src/lib/settings/defaults';

/**
 * PRODUCTION SEED.
 *
 * Creates ONLY what a working system requires:
 *   - the centre record
 *   - subject categories, subjects, levels, services, payment methods,
 *     expense categories, default settings
 *   - the current academic year
 *   - the initial administrator account (credentials come from the environment)
 *
 * It NEVER creates students, teachers, parents, payments, receipts or any other
 * business/financial record. Demo data lives in prisma/seed.demo.ts and is only
 * ever executed in development.
 */

const CENTER_CODE = process.env.SEED_CENTER_CODE ?? 'CIM';
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL ?? '').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? '';
const ADMIN_FIRST_NAME = (process.env.SEED_ADMIN_FIRST_NAME ?? 'Administrateur').trim();
const ADMIN_LAST_NAME = (process.env.SEED_ADMIN_LAST_NAME ?? 'Système').trim();
const IS_SETUP = process.env.SEED_IS_PRODUCTION_SETUP === 'true';

function resolveDatabasePath(url: string | undefined): string {
  const raw = url ?? 'file:./prisma/data/centre.db';
  const withoutScheme = raw.startsWith('file:') ? raw.slice('file:'.length) : raw;
  return path.isAbsolute(withoutScheme) ? withoutScheme : path.join(process.cwd(), withoutScheme);
}

const dbPath = resolveDatabasePath(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${dbPath}` }) });

function computeAcademicYearLabel(date: Date): string {
  const year = date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1;
  return `${year}/${year + 1}`;
}

async function main(): Promise<void> {
  const isSetup = IS_SETUP;

  if (isSetup && (!ADMIN_EMAIL || !ADMIN_PASSWORD)) {
    console.error('✗ SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required for production setup.');
    process.exit(1);
  }
  if (ADMIN_PASSWORD && ADMIN_PASSWORD.length < 8) {
    console.error('✗ The administrator password must be at least 8 characters long.');
    process.exit(1);
  }
  if (ADMIN_PASSWORD && !/[A-Za-z]/.test(ADMIN_PASSWORD)) {
    console.error('✗ The administrator password must contain at least one letter.');
    process.exit(1);
  }
  if (ADMIN_PASSWORD && !/\d/.test(ADMIN_PASSWORD)) {
    console.error('✗ The administrator password must contain at least one digit.');
    process.exit(1);
  }

  // --- Centre ---------------------------------------------------------------
  const center = await prisma.center.upsert({
    where: { code: CENTER_CODE },
    create: {
      code: CENTER_CODE,
      nameFr: process.env.SEED_CENTER_NAME_FR ?? 'Centre Imam Malik de Soutien, Formation et Langues',
      nameAr: process.env.SEED_CENTER_NAME_AR ?? 'مركز الإمام مالك للدعم والتكوين واللغات',
      address: process.env.SEED_CENTER_ADDRESS ?? null,
      city: process.env.SEED_CENTER_CITY ?? null,
      phone: process.env.SEED_CENTER_PHONE ?? null,
      whatsapp: process.env.SEED_CENTER_WHATSAPP ?? null,
      email: process.env.SEED_CENTER_EMAIL ?? null,
      primaryColor: process.env.SEED_PRIMARY_COLOR ?? '#0F766E',
      secondaryColor: process.env.SEED_SECONDARY_COLOR ?? '#F59E0B',
    },
    update: {},
  });

  // --- Reference data -------------------------------------------------------
  for (const category of DEFAULT_SUBJECT_CATEGORIES) {
    await prisma.subjectCategory.upsert({
      where: { centerId_slug: { centerId: center.id, slug: category.slug } },
      create: { centerId: center.id, slug: category.slug, nameFr: category.nameFr, nameAr: category.nameAr, sortOrder: category.sortOrder },
      update: { nameFr: category.nameFr, nameAr: category.nameAr },
    });
  }

  for (const subject of DEFAULT_SUBJECTS) {
    const category = await prisma.subjectCategory.findUnique({
      where: { centerId_slug: { centerId: center.id, slug: subject.category } },
    });
    await prisma.subject.upsert({
      where: { centerId_code: { centerId: center.id, code: subject.code } },
      create: {
        centerId: center.id,
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
    await prisma.academicLevel.upsert({
      where: { centerId_code: { centerId: center.id, code: level.code } },
      create: {
        centerId: center.id,
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
    await prisma.service.upsert({
      where: { centerId_code: { centerId: center.id, code: service.code } },
      create: {
        centerId: center.id,
        code: service.code,
        nameFr: service.nameFr,
        nameAr: service.nameAr,
        description: service.descriptionFr,
      },
      update: { nameFr: service.nameFr, nameAr: service.nameAr },
    });
  }

  for (const method of DEFAULT_PAYMENT_METHODS) {
    await prisma.paymentMethod.upsert({
      where: { centerId_code: { centerId: center.id, code: method.code } },
      create: { centerId: center.id, code: method.code, nameFr: method.nameFr, nameAr: method.nameAr, sortOrder: method.sortOrder },
      update: { nameFr: method.nameFr, nameAr: method.nameAr },
    });
  }

  for (const category of DEFAULT_EXPENSE_CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: { centerId_code: { centerId: center.id, code: category.code } },
      create: { centerId: center.id, code: category.code, nameFr: category.nameFr, nameAr: category.nameAr },
      update: { nameFr: category.nameFr, nameAr: category.nameAr },
    });
  }

  for (const [key, value] of Object.entries(DEFAULT_CENTER_SETTINGS)) {
    await prisma.centerSetting.upsert({
      where: { centerId_key: { centerId: center.id, key } },
      create: { centerId: center.id, key, value },
      update: {},
    });
  }

  // --- Current academic year ------------------------------------------------
  const now = new Date();
  const yearLabel = process.env.SEED_ACADEMIC_YEAR ?? computeAcademicYearLabel(now);
  const yearExists = await prisma.academicYear.findUnique({
    where: { centerId_label: { centerId: center.id, label: yearLabel } },
  });
  if (!yearExists) {
    const startYear = Number.parseInt(yearLabel.slice(0, 4), 10);
    await prisma.academicYear.create({
      data: {
        centerId: center.id,
        label: yearLabel,
        startDate: new Date(startYear, 8, 1),
        endDate: new Date(startYear + 1, 7, 31),
        isCurrent: true,
      },
    });
  }

  // --- Administrator --------------------------------------------------------
  if (ADMIN_EMAIL) {
    const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
    if (existing) {
      console.log(`  = administrator already exists: ${ADMIN_EMAIL}`);
    } else {
      await prisma.user.create({
        data: {
          centerId: center.id,
          email: ADMIN_EMAIL,
          passwordHash: await hash(ADMIN_PASSWORD, 12),
          firstName: ADMIN_FIRST_NAME,
          lastName: ADMIN_LAST_NAME,
          role: 'ADMIN',
          permissions: JSON.stringify([]),
          isActive: true,
          // Forces the administrator to replace the installer-provided password.
          mustChangePassword: true,
        },
      });
      console.log(`  + administrator created: ${ADMIN_EMAIL}`);
    }
  } else {
    console.log('  ! no administrator created (SEED_ADMIN_EMAIL not set)');
    console.log('    run "npm run setup" or install.bat to create the admin account');
  }

  const counts = {
    subjects: await prisma.subject.count({ where: { centerId: center.id } }),
    levels: await prisma.academicLevel.count({ where: { centerId: center.id } }),
    services: await prisma.service.count({ where: { centerId: center.id } }),
    users: await prisma.user.count({ where: { centerId: center.id } }),
    students: await prisma.student.count({ where: { centerId: center.id } }),
  };

  console.log('✓ production reference data installed');
  console.log(`  centre: ${center.nameFr}`);
  console.log(`  subjects: ${counts.subjects} | levels: ${counts.levels} | services: ${counts.services} | users: ${counts.users}`);
  if (counts.students > 0) {
    console.log(`  note: database already contains ${counts.students} student(s); seed did not add demo data.`);
  }
}

main()
  .catch((error) => {
    console.error('✗ seed failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
