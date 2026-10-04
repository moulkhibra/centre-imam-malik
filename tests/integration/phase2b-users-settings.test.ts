import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', async () => {
  const { createNextHeadersMock } = await import('../helpers/cookie-jar');
  return createNextHeadersMock();
});

// `revalidatePath` throws outside a Next request scope and the actions call it
// after every successful write. Re-rendering is Next's job and not what these
// tests are about.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { prisma } = await import('@/lib/db/client');
const { listUsers, getUser, countActiveAdmins, listTeacherAccountOptions } = await import('@/lib/users/queries');
const {
  createUserAction,
  updateUserAction,
  changeUserRoleAction,
  setUserActiveAction,
  resetUserPasswordAction,
} = await import('@/actions/users');
const { updateCenterSettingsAction } = await import('@/actions/settings');
const { getCenterSettingsFormValues } = await import('@/lib/settings/center');
const { createSession } = await import('@/lib/auth/session');
const { verifyPassword } = await import('@/lib/auth/password');
const { truncateAllTables } = await import('../helpers/test-db');
const { createCenter, createUser } = await import('../helpers/factories');

/**
 * Phase 2B: accounts and centre settings against the real schema.
 *
 * Real SQLite, not mocks, for the reasons the people suite states: a missing
 * `centerId` cannot hide behind a stub, and the behaviours that matter here are
 * database behaviours - the unique index on `teacherId`, the revocation of the
 * open sessions, the transaction that must not half-save a settings screen.
 *
 * Every test signs in as a real session and calls the real Server Action, so the
 * permission check under test is the one that runs in production.
 */

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.append(key, value);
  return data;
}

const ACCOUNT_FORM = {
  firstName: 'Amine',
  lastName: 'Alaoui',
  phone: '',
  role: 'SECRETARY',
  locale: 'fr',
  teacherId: '',
};

const SETTINGS_FORM = {
  code: 'CIM',
  nameFr: 'Centre Imam Malik',
  nameAr: 'مركز الإمام مالك',
  legalName: '',
  address: '',
  city: 'Casablanca',
  phone: '',
  whatsapp: '',
  email: '',
  facebook: '',
  instagram: '',
  website: '',
  logoPath: '',
  primaryColor: '#1d4ed8',
  secondaryColor: '#0f172a',
  timezone: 'Africa/Casablanca',
  locale: 'fr',
  receiptFooterFr: '',
  receiptFooterAr: '',
  certificateFooterFr: '',
  certificateFooterAr: '',
  directorNameFr: '',
  directorNameAr: '',
};

async function seedTeacher(centerId: string, overrides: Record<string, unknown> = {}) {
  return prisma.teacher.create({
    data: {
      centerId,
      code: (overrides.code as string) ?? `T-${Math.random().toString(36).slice(2, 8)}`,
      firstName: (overrides.firstName as string) ?? 'Samir',
      lastName: (overrides.lastName as string) ?? 'Bennani',
      ...(overrides.firstNameAr !== undefined ? { firstNameAr: overrides.firstNameAr as string } : {}),
      ...(overrides.lastNameAr !== undefined ? { lastNameAr: overrides.lastNameAr as string } : {}),
      ...(overrides.deletedAt !== undefined ? { deletedAt: overrides.deletedAt as Date | null } : {}),
    },
  });
}

describe('accounts queries', () => {
  let centerId: string;
  let otherCenterId: string;

  beforeEach(async () => {
    await truncateAllTables(prisma);
    centerId = (await createCenter()).id;
    otherCenterId = (await createCenter()).id;
  });

  it('never returns another centre\'s accounts', async () => {
    await createUser(centerId, { email: 'mine@example.test', lastName: 'Alpha' });
    await createUser(otherCenterId, { email: 'theirs@example.test', lastName: 'Beta' });

    const { rows, pagination } = await listUsers(centerId, {});
    expect(rows.map((row) => row.email)).toEqual(['mine@example.test']);
    expect(pagination.total).toBe(1);
  });

  it('hides a soft-deleted account from the list and from getUser', async () => {
    const kept = await createUser(centerId, { email: 'kept@example.test' });
    const gone = await createUser(centerId, { email: 'gone@example.test' });
    await prisma.user.update({ where: { id: gone.id }, data: { deletedAt: new Date() } });

    const { rows } = await listUsers(centerId, {});
    expect(rows.map((row) => row.id)).toEqual([kept.id]);
    expect(await getUser(centerId, gone.id)).toBeNull();
  });

  it('never selects the password hash', async () => {
    const user = await createUser(centerId, {});
    const row = (await listUsers(centerId, {})).rows[0];
    expect(row).toBeDefined();
    expect(Object.keys(row ?? {})).not.toContain('passwordHash');
    // `getUser` is the shape an edit form is built from; it must not carry a hash
    // either, or one stray spread would send it to the browser.
    const single = await getUser(centerId, user.id);
    expect(single).not.toBeNull();
    expect(Object.keys(single ?? {})).not.toContain('passwordHash');
  });

  it('searches the e-mail, the names and the phone, and treats % as a literal', async () => {
    await createUser(centerId, { email: 'amine@centre.test', firstName: 'Amine', lastName: 'Alaoui', phone: '0612345678' });
    await createUser(centerId, { email: 'chaimae@centre.test', firstName: 'Chaimae', lastName: 'Berrada' });
    await createUser(centerId, { email: 'percent@centre.test', lastName: '100% Rachid' });

    expect((await listUsers(centerId, { q: 'chaimae' })).rows).toHaveLength(1);
    expect((await listUsers(centerId, { q: 'Alaoui' })).rows).toHaveLength(1);
    expect((await listUsers(centerId, { q: '0612345678' })).rows).toHaveLength(1);
    expect((await listUsers(centerId, { q: '%' })).rows).toEqual([]);
    expect((await listUsers(centerId, { q: '100%' })).rows).toHaveLength(1);
  });

  it('filters by role, by state and by a pending password, and ALL means none', async () => {
    await createUser(centerId, { role: 'SECRETARY' });
    await createUser(centerId, { role: 'TEACHER', isActive: false });
    await createUser(centerId, { role: 'ADMIN', mustChangePassword: true });

    const byRole = await listUsers(centerId, { filter: { role: 'TEACHER' } });
    expect(byRole.rows).toHaveLength(1);
    expect(byRole.rows[0]?.isActive).toBe(false);

    expect((await listUsers(centerId, { filter: { status: 'ACTIVE' } })).rows).toHaveLength(2);
    expect((await listUsers(centerId, { filter: { status: 'INACTIVE' } })).rows).toHaveLength(1);
    expect((await listUsers(centerId, { filter: { password: 'PENDING' } })).rows).toHaveLength(1);
    expect((await listUsers(centerId, { filter: { role: 'ALL', status: 'ALL', password: 'ALL' } })).rows).toHaveLength(3);
  });

  it('sorts by the requested column and paginates', async () => {
    for (const lastName of ['Tazi', 'Mansouri', 'Zouiten', 'Bennani', 'Alaoui', 'Amrani']) {
      await createUser(centerId, { lastName });
    }

    const asc = await listUsers(centerId, { sort: 'lastName', dir: 'asc' });
    expect(asc.rows.map((row) => row.lastName)).toEqual([
      'Alaoui',
      'Amrani',
      'Bennani',
      'Mansouri',
      'Tazi',
      'Zouiten',
    ]);

    const desc = await listUsers(centerId, { sort: 'lastName', dir: 'desc' });
    expect(desc.rows.map((row) => row.lastName)).toEqual([
      'Zouiten',
      'Tazi',
      'Mansouri',
      'Bennani',
      'Amrani',
      'Alaoui',
    ]);

    // The shared parser refuses a page size below 5, so the second page is
    // reached with the smallest size it accepts.
    const page = await listUsers(centerId, { pageSize: 5, page: 2, sort: 'lastName', dir: 'asc' });
    expect(page.rows.map((row) => row.lastName)).toEqual(['Zouiten']);
    expect(page.pagination).toMatchObject({ total: 6, page: 2, pageSize: 5, totalPages: 2, from: 6, to: 6 });
  });

  it('counts the active administrators, optionally excluding one', async () => {
    const first = await createUser(centerId, { role: 'ADMIN' });
    await createUser(centerId, { role: 'ADMIN' });
    await createUser(centerId, { role: 'ADMIN', isActive: false });
    await createUser(otherCenterId, { role: 'ADMIN' });

    expect(await countActiveAdmins(centerId)).toBe(2);
    expect(await countActiveAdmins(centerId, first.id)).toBe(1);
  });

  it('lists the catalogue teachers with the account that already claims each', async () => {
    const free = await seedTeacher(centerId, { lastName: 'Bennani' });
    const claimed = await seedTeacher(centerId, { lastName: 'Tazi' });
    const softDeleted = await seedTeacher(centerId, { lastName: 'Supprime', deletedAt: new Date() });
    await createUser(centerId, {
      role: 'TEACHER',
      email: 'samir@centre.test',
      teacherId: claimed.id,
    });

    const options = await listTeacherAccountOptions(centerId);
    expect(options.map((option) => option.id).sort()).toEqual([free.id, claimed.id].sort());
    expect(options.find((option) => option.id === claimed.id)?.account?.email).toBe('samir@centre.test');
    expect(options.find((option) => option.id === free.id)?.account).toBeNull();
    expect(options.map((option) => option.id)).not.toContain(softDeleted.id);
  });

  it('joins the linked teacher so the list can name it', async () => {
    const teacher = await seedTeacher(centerId, { firstName: 'Samir', lastName: 'Bennani', firstNameAr: 'سمير', lastNameAr: 'بناني' });
    await createUser(centerId, { role: 'TEACHER', teacherId: teacher.id });

    const row = (await listUsers(centerId, {})).rows[0];
    expect(row?.teacher).toMatchObject({ code: teacher.code, lastNameAr: 'بناني' });
  });
});

describe('accounts actions', () => {
  let center: { id: string };
  let admin: { id: string };

  beforeEach(async () => {
    await truncateAllTables(prisma);
    center = await createCenter();
    admin = await createUser(center.id, { role: 'ADMIN' });
  });

  async function signIn(userId: string) {
    await createSession(userId);
  }

  it('creates an account that must change its password, hashed, and audits it', async () => {
    await signIn(admin.id);
    const result = await createUserAction(
      form({ ...ACCOUNT_FORM, email: 'nouveau@centre.test', password: 'Tem3!Passw0rd' }),
    );

    expect(result.ok).toBe(true);
    const created = await prisma.user.findUniqueOrThrow({ where: { id: (result as { data: { id: string } }).data.id } });
    expect(created.mustChangePassword).toBe(true);
    expect(created.isActive).toBe(true);
    expect(created.centerId).toBe(center.id);
    expect(created.permissions).toBe('[]');
    // The hash is the only thing stored: the typed password must not be readable.
    expect(created.passwordHash).not.toContain('Tem3!Passw0rd');
    expect(await verifyPassword('Tem3!Passw0rd', created.passwordHash)).toBe(true);

    const entry = await prisma.auditLog.findFirstOrThrow({ where: { entityType: 'User', entityId: created.id } });
    expect(entry.action).toBe('CREATE');
    expect(entry.userId).toBe(admin.id);
    expect(entry.metadata).toContain('nouveau@centre.test');
  });

  it('never puts the password in the audit entry', async () => {
    await signIn(admin.id);
    await createUserAction(form({ ...ACCOUNT_FORM, email: 'secret@centre.test', password: 'Tem3!Passw0rd' }));

    const entry = await prisma.auditLog.findFirstOrThrow({ where: { entityType: 'User' } });
    expect(entry.metadata).not.toContain('Tem3!Passw0rd');
  });

  it('refuses a create for a role without users.manage', async () => {
    const directeur = await createUser(center.id, { role: 'DIRECTEUR' });
    await signIn(directeur.id);
    const result = await createUserAction(form({ ...ACCOUNT_FORM, email: 'x@centre.test', password: 'Tem3!Passw0rd' }));

    expect(result).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(await prisma.user.count({ where: { email: 'x@centre.test' } })).toBe(0);
  });

  it('reports a duplicate e-mail without writing a second account', async () => {
    await signIn(admin.id);
    await createUser(center.id, { email: 'double@centre.test' });
    const result = await createUserAction(form({ ...ACCOUNT_FORM, email: 'double@centre.test', password: 'Tem3!Passw0rd' }));

    expect(result).toMatchObject({ ok: false, code: 'DUPLICATE' });
    expect(await prisma.user.count({ where: { email: 'double@centre.test' } })).toBe(1);
  });

  it('refuses a teacher from another centre', async () => {
    const other = await createCenter();
    const foreign = await seedTeacher(other.id);
    await signIn(admin.id);

    const result = await createUserAction(
      form({ ...ACCOUNT_FORM, role: 'TEACHER', email: 'prof@centre.test', password: 'Tem3!Passw0rd', teacherId: foreign.id }),
    );

    expect(result).toMatchObject({ ok: false, code: 'VALIDATION', errorKey: 'errors.teacherNotFound' });
    expect(await prisma.user.count({ where: { email: 'prof@centre.test' } })).toBe(0);
  });

  it('refuses a teacher another account already claims', async () => {
    const teacher = await seedTeacher(center.id);
    await createUser(center.id, { role: 'TEACHER', email: 'premier@centre.test', teacherId: teacher.id });
    await signIn(admin.id);

    const result = await createUserAction(
      form({ ...ACCOUNT_FORM, role: 'TEACHER', email: 'second@centre.test', password: 'Tem3!Passw0rd', teacherId: teacher.id }),
    );

    expect(result).toMatchObject({ ok: false, code: 'VALIDATION', errorKey: 'errors.teacherAlreadyLinked' });
    expect(await prisma.user.count({ where: { email: 'second@centre.test' } })).toBe(0);
  });

  it('keeps the current link when the same account saves the same teacher again', async () => {
    const teacher = await seedTeacher(center.id);
    const account = await createUser(center.id, { role: 'TEACHER', teacherId: teacher.id });
    await signIn(admin.id);

    const result = await updateUserAction(
      account.id,
      form({ ...ACCOUNT_FORM, role: 'TEACHER', email: account.email, firstName: 'Samir', lastName: 'Bennani', teacherId: teacher.id }),
    );

    expect(result.ok).toBe(true);
    expect((await getUser(center.id, account.id))?.teacherId).toBe(teacher.id);
  });

  it('lets an administrator correct their own details but not their own role', async () => {
    await signIn(admin.id);

    const identity = await updateUserAction(
      admin.id,
      form({ ...ACCOUNT_FORM, role: 'ADMIN', email: 'admin@centre.test', firstName: 'Amine', lastName: 'Alami', phone: '0600000000' }),
    );
    expect(identity.ok).toBe(true);
    expect((await getUser(center.id, admin.id))?.lastName).toBe('Alami');

    const demotion = await changeUserRoleAction(admin.id, form({ role: 'SECRETARY' }));
    expect(demotion).toMatchObject({ ok: false, code: 'CONFLICT', errorKey: 'errors.selfAccessChange' });
    expect((await getUser(center.id, admin.id))?.role).toBe('ADMIN');
  });

  it('refuses to deactivate your own account', async () => {
    await signIn(admin.id);
    const result = await setUserActiveAction(admin.id, false);

    expect(result).toMatchObject({ ok: false, code: 'CONFLICT', errorKey: 'errors.selfAccessChange' });
    expect((await getUser(center.id, admin.id))?.isActive).toBe(true);
  });

  it('refuses to demote or deactivate the last active administrator', async () => {
    await signIn(admin.id);

    const demotion = await changeUserRoleAction(admin.id, form({ role: 'DIRECTEUR' }));
    const selfOff = await setUserActiveAction(admin.id, false);

    expect(demotion).toMatchObject({ ok: false, errorKey: 'errors.selfAccessChange' });
    expect(selfOff).toMatchObject({ ok: false, errorKey: 'errors.selfAccessChange' });

    // With a second administrator, demoting the other one is allowed: the guard
    // asks "is anybody left", not "are there two".
    const second = await createUser(center.id, { role: 'ADMIN' });
    const demoteOther = await changeUserRoleAction(second.id, form({ role: 'SECRETARY' }));
    expect(demoteOther.ok).toBe(true);
    expect((await getUser(center.id, second.id))?.role).toBe('SECRETARY');
  });

  it('refuses to deactivate the last active administrator', async () => {
    // The actor cannot be an active administrator: an active ADMIN always counts
    // as somebody left. So the guard is reached by an account that holds
    // `users.manage` as an extra permission on a non-administrator role, which
    // is exactly the case the rule exists for - a delegated user manager.
    const delegated = await createUser(center.id, { role: 'SECRETARY', permissions: ['users.manage'] });
    await signIn(delegated.id);

    const result = await setUserActiveAction(admin.id, false);

    expect(result).toMatchObject({ ok: false, code: 'CONFLICT', errorKey: 'errors.lastAdmin' });
    expect((await getUser(center.id, admin.id))?.isActive).toBe(true);
    // The same rule applies to a demotion: the last active administrator stays.
    expect(await changeUserRoleAction(admin.id, form({ role: 'SECRETARY' }))).toMatchObject({
      ok: false,
      code: 'CONFLICT',
      errorKey: 'errors.lastAdmin',
    });
  });

  it('audits a role change as a permission change, not as a plain update', async () => {
    const secretary = await createUser(center.id, { role: 'SECRETARY' });
    await signIn(admin.id);
    const result = await changeUserRoleAction(secretary.id, form({ role: 'DIRECTEUR' }));

    expect(result.ok).toBe(true);
    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { entityType: 'User', entityId: secretary.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(entry.action).toBe('PERMISSION_CHANGE');
    expect(entry.metadata).toContain('SECRETARY');
    expect(entry.metadata).toContain('DIRECTEUR');
  });

  it('deactivates reversibly, keeps the row and revokes the open sessions', async () => {
    const secretary = await createUser(center.id, { role: 'SECRETARY' });
    await createSession(secretary.id);
    await signIn(admin.id);

    const off = await setUserActiveAction(secretary.id, false);
    expect(off.ok).toBe(true);

    const afterOff = await prisma.user.findUniqueOrThrow({ where: { id: secretary.id } });
    expect(afterOff.isActive).toBe(false);
    // Nothing is destroyed: the account keeps its identity and its history.
    expect(afterOff.deletedAt).toBeNull();
    expect(await prisma.auditLog.count({ where: { entityId: secretary.id, entityType: 'User' } })).toBeGreaterThan(0);
    expect(await prisma.session.count({ where: { userId: secretary.id, revokedAt: null } })).toBe(0);

    const on = await setUserActiveAction(secretary.id, true);
    expect(on.ok).toBe(true);
    expect((await getUser(center.id, secretary.id))?.isActive).toBe(true);
  });

  it('resets a password: new hash, change required, lockout cleared, sessions revoked', async () => {
    const secretary = await createUser(center.id, {
      role: 'SECRETARY',
      password: 'Ancien!Passw0rd',
      mustChangePassword: false,
    });
    await prisma.user.update({
      where: { id: secretary.id },
      data: { failedLoginAttempts: 4, lockedUntil: new Date(Date.now() + 3_600_000) },
    });
    await createSession(secretary.id);
    await signIn(admin.id);

    const before = await prisma.user.findUniqueOrThrow({ where: { id: secretary.id } });
    const result = await resetUserPasswordAction(
      secretary.id,
      form({ password: 'Nouveau!Passw0rd', confirmPassword: 'Nouveau!Passw0rd' }),
    );

    expect(result.ok).toBe(true);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: secretary.id } });
    expect(after.passwordHash).not.toBe(before.passwordHash);
    expect(await verifyPassword('Nouveau!Passw0rd', after.passwordHash)).toBe(true);
    expect(await verifyPassword('Ancien!Passw0rd', after.passwordHash)).toBe(false);
    expect(after.mustChangePassword).toBe(true);
    expect(after.failedLoginAttempts).toBe(0);
    expect(after.lockedUntil).toBeNull();
    // The stolen-cookie case: an open tab must not survive a reset.
    expect(await prisma.session.count({ where: { userId: secretary.id, revokedAt: null } })).toBe(0);

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { entityType: 'User', entityId: secretary.id, action: 'PASSWORD_RESET' },
    });
    expect(entry.userId).toBe(admin.id);
    expect(entry.metadata).not.toContain('Nouveau!Passw0rd');
  });

  it('refuses a reset whose confirmation does not match, without touching the account', async () => {
    const secretary = await createUser(center.id, { password: 'Ancien!Passw0rd' });
    await signIn(admin.id);
    const before = await prisma.user.findUniqueOrThrow({ where: { id: secretary.id } });

    const result = await resetUserPasswordAction(
      secretary.id,
      form({ password: 'Nouveau!Passw0rd', confirmPassword: 'Autre!Passw0rd' }),
    );

    expect(result).toMatchObject({ ok: false, code: 'VALIDATION' });
    if (!result.ok) expect(result.fieldErrors?.confirmPassword).toBeTruthy();
    const after = await prisma.user.findUniqueOrThrow({ where: { id: secretary.id } });
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.mustChangePassword).toBe(false);
  });

  it('refuses to touch an account of another centre', async () => {
    const other = await createCenter();
    const foreign = await createUser(other.id, { role: 'SECRETARY' });
    await signIn(admin.id);

    const update = await updateUserAction(foreign.id, form({ ...ACCOUNT_FORM, email: 'pirate@centre.test' }));
    const reset = await resetUserPasswordAction(foreign.id, form({ password: 'Tem3!Passw0rd', confirmPassword: 'Tem3!Passw0rd' }));
    const off = await setUserActiveAction(foreign.id, false);

    expect(update).toMatchObject({ ok: false, code: 'NOT_FOUND', errorKey: 'errors.userNotFound' });
    expect(reset).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(off).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: foreign.id } })).isActive).toBe(true);
  });

  it('refuses every account action without a session', async () => {
    const result = await createUserAction(form({ ...ACCOUNT_FORM, email: 'x@centre.test', password: 'Tem3!Passw0rd' }));
    expect(result).toMatchObject({ ok: false, code: 'UNAUTHENTICATED' });
    expect(await prisma.user.count({ where: { email: 'x@centre.test' } })).toBe(0);
  });
});

describe('centre settings', () => {
  let center: { id: string };
  let admin: { id: string };

  beforeEach(async () => {
    await truncateAllTables(prisma);
    center = await createCenter({ code: 'CIM' });
    admin = await createUser(center.id, { role: 'ADMIN' });
  });

  async function signIn(userId: string) {
    await createSession(userId);
  }

  it('writes the centre columns and the settings rows together, and audits it', async () => {
    await signIn(admin.id);
    const result = await updateCenterSettingsAction(
      form({ ...SETTINGS_FORM, nameFr: 'Centre Imam Malik', city: 'Casablanca', locale: 'ar', receiptFooterAr: 'شكرا لثقتكم' }),
    );

    expect(result.ok).toBe(true);
    const updated = await prisma.center.findUniqueOrThrow({ where: { id: center.id } });
    expect(updated.nameFr).toBe('Centre Imam Malik');
    expect(updated.city).toBe('Casablanca');

    const settings = await prisma.centerSetting.findMany({ where: { centerId: center.id } });
    const byKey = new Map(settings.map((row) => [row.key, row.value]));
    expect(byKey.get('center.locale')).toBe('ar');
    expect(byKey.get('receipt.footerAr')).toBe('شكرا لثقتكم');

    const entry = await prisma.auditLog.findFirstOrThrow({ where: { entityType: 'Center', entityId: center.id } });
    expect(entry.action).toBe('SETTINGS_CHANGE');
    // The diff names what changed, so an auditor does not have to diff two rows.
    expect(entry.metadata).toContain('city');
  });

  it('writes the centre of the signed-in administrator, never the active one', async () => {
    const other = await createCenter({ code: 'AUTRE' });
    const otherAdmin = await createUser(other.id, { role: 'ADMIN' });
    await prisma.center.update({ where: { id: other.id }, data: { active: true } });
    await prisma.center.update({ where: { id: center.id }, data: { active: false } });

    await signIn(otherAdmin.id);
    const result = await updateCenterSettingsAction(form({ ...SETTINGS_FORM, code: 'AUTRE', city: 'Rabat' }));

    expect(result.ok).toBe(true);
    expect((await prisma.center.findUniqueOrThrow({ where: { id: other.id } })).city).toBe('Rabat');
    // The other centre is untouched, even though it is the active one.
    const untouched = await prisma.center.findUniqueOrThrow({ where: { id: center.id } });
    expect(untouched.city).toBeNull();
  });

  it('saves nothing when one value is refused', async () => {
    await signIn(admin.id);
    const before = await prisma.center.findUniqueOrThrow({ where: { id: center.id } });

    const result = await updateCenterSettingsAction(
      form({ ...SETTINGS_FORM, nameFr: 'Nom valide', primaryColor: 'pas-une-couleur' }),
    );

    expect(result).toMatchObject({ ok: false, code: 'VALIDATION' });
    const after = await prisma.center.findUniqueOrThrow({ where: { id: center.id } });
    expect(after.nameFr).toBe(before.nameFr);
    expect(await prisma.centerSetting.count({ where: { centerId: center.id, key: 'center.locale' } })).toBe(0);
  });

  it('rolls back the centre row when the code is already taken', async () => {
    await createCenter({ code: 'PRIS' });
    await signIn(admin.id);
    const before = await prisma.center.findUniqueOrThrow({ where: { id: center.id } });

    const result = await updateCenterSettingsAction(form({ ...SETTINGS_FORM, code: 'PRIS', city: 'Fes' }));

    expect(result).toMatchObject({ ok: false, code: 'DUPLICATE' });
    const after = await prisma.center.findUniqueOrThrow({ where: { id: center.id } });
    expect(after.city).toBe(before.city);
    expect(await prisma.centerSetting.count({ where: { centerId: center.id, key: 'center.locale' } })).toBe(0);
  });

  it('refuses a logo path outside the public directory', async () => {
    await signIn(admin.id);

    for (const logoPath of ['../../etc/passwd', 'https://example.test/logo.png', 'logo.png']) {
      const result = await updateCenterSettingsAction(form({ ...SETTINGS_FORM, logoPath }));
      expect(result, logoPath).toMatchObject({ ok: false, code: 'VALIDATION' });
    }
    expect((await prisma.center.findUniqueOrThrow({ where: { id: center.id } })).logoPath).toBeNull();
  });

  it('refuses the screen to a role without settings.manage', async () => {
    const directeur = await createUser(center.id, { role: 'DIRECTEUR' });
    await signIn(directeur.id);

    const result = await updateCenterSettingsAction(form({ ...SETTINGS_FORM, city: 'Tanger' }));

    expect(result).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect((await prisma.center.findUniqueOrThrow({ where: { id: center.id } })).city).toBeNull();
  });

  it('serves the form values of the requested centre, with the shipped defaults filled in', async () => {
    await prisma.centerSetting.createMany({
      data: [
        { centerId: center.id, key: 'center.locale', value: 'ar' },
        { centerId: center.id, key: 'receipt.footerFr', value: 'Pied personnalisé' },
      ],
    });

    const values = await getCenterSettingsFormValues(center.id);
    expect(values).toMatchObject({
      code: 'CIM',
      nameFr: 'Centre de test',
      phone: '06 00 00 00 00',
      locale: 'ar',
      receiptFooterFr: 'Pied personnalisé',
      // Never set by this centre: the shipped default, not an empty input.
      directorNameFr: 'Le Directeur',
    });
    // Null columns reach the form as empty strings: an input cannot hold null.
    expect(values?.logoPath).toBe('');
    expect(values?.city).toBe('');
    // A column that is set is passed through untouched, Arabic included.
    expect(values?.nameAr).toBe('مركز تجريبي');
    expect(await getCenterSettingsFormValues('centre-inexistant')).toBeNull();
  });
});