import { prisma } from '@/lib/db/client';
import { hashPassword } from '@/lib/auth/password';
import type { PrismaClient } from '@/generated/prisma/client';
import type { Role } from '@/lib/constants';

/**
 * Integration-test factories.
 *
 * These create the MINIMUM a test needs: a centre, and the accounts involved.
 * They deliberately create no business data (students, payments, ...) so a
 * passing test never depends on fake financial records.
 */

export type TestDb = PrismaClient;

let counter = 0;
export function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export async function resetDatabase(): Promise<void> {
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.center.deleteMany();
}

export async function createCenter(overrides: { code?: string; nameFr?: string } = {}) {
  return prisma.center.create({
    data: {
      code: overrides.code ?? unique('CENTER').toUpperCase(),
      nameFr: overrides.nameFr ?? 'Centre de test',
      nameAr: 'مركز تجريبي',
      phone: '06 00 00 00 00',
    },
  });
}

export async function createUser(
  centerId: string,
  options: {
    email?: string;
    password?: string;
    role?: Role;
    permissions?: string[];
    isActive?: boolean;
    mustChangePassword?: boolean;
    firstName?: string;
    lastName?: string;
  } = {},
) {
  const password = options.password ?? 'Passw0rd!2026';
  return prisma.user.create({
    data: {
      centerId,
      email: (options.email ?? `${unique('user').toLowerCase()}@example.test`).toLowerCase(),
      passwordHash: await hashPassword(password),
      firstName: options.firstName ?? 'Amine',
      lastName: options.lastName ?? 'Test',
      role: options.role ?? 'SECRETARY',
      permissions: JSON.stringify(options.permissions ?? []),
      isActive: options.isActive ?? true,
      mustChangePassword: options.mustChangePassword ?? false,
    },
  });
}

/** Centre + admin, the baseline for most integration tests. */
export async function seedCenterWithAdmin() {
  const center = await createCenter();
  const admin = await createUser(center.id, {
    email: 'admin@example.test',
    password: 'Adm1n!Pass2026',
    role: 'ADMIN',
  });
  return { center, admin, password: 'Adm1n!Pass2026' };
}
