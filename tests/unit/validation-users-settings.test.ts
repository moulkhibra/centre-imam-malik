import { describe, expect, it } from 'vitest';
import {
  passwordResetSchema,
  roleChangeSchema,
  userCreateSchema,
  userFilterSchema,
  userUpdateSchema,
} from '@/lib/validation/users';
import { CENTER_SETTING_KEYS, centerSettingsSchema, centerSettingEntries } from '@/lib/validation/settings';

/**
 * Validation of the Phase 2B forms.
 *
 * Both screens are parsed twice - once by the Client Component, once by the
 * Server Action - so what is asserted here is what reaches the database. The
 * recurring rule is the one the columns make necessary: an optional field left
 * blank must arrive as `null`, never as `''`. A nullable column holding an empty
 * string is a row that looks filled in and matches no search for "no value".
 */

const validAccount = {
  email: 'Amine@Centre.Test',
  firstName: 'Amine',
  lastName: 'Alaoui',
  phone: '',
  role: 'SECRETARY',
  locale: 'fr',
  teacherId: '',
  password: 'Tem3!Passw0rd',
};

const validSettings = {
  code: 'CIM',
  nameFr: 'Centre Imam Malik',
  primaryColor: '#1d4ed8',
  secondaryColor: '#0f172a',
  timezone: 'Africa/Casablanca',
  locale: 'fr',
};

describe('account schemas', () => {
  it('accepts a complete account and lowercases the e-mail', () => {
    const parsed = userCreateSchema.parse(validAccount);
    expect(parsed.email).toBe('amine@centre.test');
    expect(parsed.role).toBe('SECRETARY');
    expect(parsed.locale).toBe('fr');
  });

  it('normalises every blank optional field to null, the linked teacher included', () => {
    const parsed = userCreateSchema.parse({ ...validAccount, phone: '   ', teacherId: '' });
    expect(parsed.phone).toBeNull();
    expect(parsed.teacherId).toBeNull();
  });

  it('refuses an unknown role or locale instead of storing it', () => {
    expect(userCreateSchema.safeParse({ ...validAccount, role: 'SUPERUSER' }).success).toBe(false);
    expect(userCreateSchema.safeParse({ ...validAccount, locale: 'en' }).success).toBe(false);
  });

  it('requires an e-mail, a name and a usable password', () => {
    expect(userCreateSchema.safeParse({ ...validAccount, email: '' }).success).toBe(false);
    expect(userCreateSchema.safeParse({ ...validAccount, email: 'pas-un-email' }).success).toBe(false);
    expect(userCreateSchema.safeParse({ ...validAccount, firstName: '' }).success).toBe(false);
    expect(userCreateSchema.safeParse({ ...validAccount, lastName: '1' }).success).toBe(false);
    // 8 characters minimum, at least one letter and one digit.
    expect(userCreateSchema.safeParse({ ...validAccount, password: 'court1' }).success).toBe(false);
    expect(userCreateSchema.safeParse({ ...validAccount, password: '1234567890' }).success).toBe(false);
    expect(userCreateSchema.safeParse({ ...validAccount, password: 'motdepasse' }).success).toBe(false);
  });

  it('keeps the password rule and its Arabic message together', () => {
    const parsed = userCreateSchema.safeParse({ ...validAccount, password: '123' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    // A `validation.*` key, never a sentence: the schema cannot know the reader's
    // locale, so the text is resolved where it is displayed.
    expect(parsed.error.issues[0]?.message).toMatch(/^validation\./);
  });

  it('has no password field on the update schema', () => {
    // Changing a password is a separate confirmed action that revokes the open
    // sessions; an identity form that could also change it would bypass that.
    const withPassword = userUpdateSchema.safeParse({ ...validAccount, password: 'Autre!Passw0rd' });
    expect(withPassword.success).toBe(true);
    expect((withPassword as { data: Record<string, unknown> }).data).not.toHaveProperty('password');
  });

  it('defaults the role and the locale on create, and requires both on update', () => {
    const created = userCreateSchema.parse({
      email: 'x@centre.test',
      firstName: 'Amine',
      lastName: 'Alaoui',
      password: 'Tem3!Passw0rd',
    });
    expect(created.role).toBe('SECRETARY');
    expect(created.locale).toBe('fr');
    expect(created.teacherId).toBeNull();

    expect(userUpdateSchema.safeParse({ ...validAccount, role: undefined }).success).toBe(false);
    expect(userUpdateSchema.safeParse({ ...validAccount, locale: undefined }).success).toBe(false);
  });

  it('refuses a reset whose confirmation does not match, and blames that field', () => {
    const parsed = passwordResetSchema.safeParse({ password: 'Tem3!Passw0rd', confirmPassword: 'Autre!Passw0rd' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.path).toEqual(['confirmPassword']);
  });

  it('accepts a reset with two matching passwords', () => {
    const parsed = passwordResetSchema.safeParse({ password: 'Tem3!Passw0rd', confirmPassword: 'Tem3!Passw0rd' });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.password).toBe('Tem3!Passw0rd');
  });

  it('validates a role change on its own', () => {
    expect(roleChangeSchema.safeParse({ role: 'TEACHER' }).success).toBe(true);
    expect(roleChangeSchema.safeParse({ role: 'ROOT' }).success).toBe(false);
    expect(roleChangeSchema.safeParse({}).success).toBe(false);
  });

  it('reads the list filters, with ALL as the neutral value', () => {
    expect(userFilterSchema.parse({ role: 'ALL', status: 'ACTIVE', password: 'PENDING' })).toEqual({
      role: 'ALL',
      status: 'ACTIVE',
      password: 'PENDING',
    });
    // An empty filter object is legal: the toolbar posts only what is set.
    expect(userFilterSchema.parse({})).toEqual({ role: 'ALL', status: 'ALL', password: 'ALL' });
    // A value outside the vocabulary falls back to ALL rather than 500ing the
    // page on a hand-edited URL.
    expect(userFilterSchema.parse({ role: 'SUPERUSER' }).role).toBe('ALL');
    expect(userFilterSchema.parse({ status: 'PENDING' }).status).toBe('ALL');
  });
});

describe('centre settings schema', () => {
  it('accepts the identity fields alone and fills the rest with null', () => {
    const parsed = centerSettingsSchema.parse(validSettings);
    expect(parsed.nameFr).toBe('Centre Imam Malik');
    expect(parsed.nameAr).toBeNull();
    expect(parsed.logoPath).toBeNull();
    expect(parsed.receiptFooterFr).toBeNull();
  });

  it('normalises blank fields to null instead of storing an empty string', () => {
    const parsed = centerSettingsSchema.parse({ ...validSettings, city: '', facebook: '  ', receiptFooterAr: '' });
    expect(parsed.city).toBeNull();
    expect(parsed.facebook).toBeNull();
    expect(parsed.receiptFooterAr).toBeNull();
  });

  it('requires the centre code to be usable, and uppercases it', () => {
    expect(centerSettingsSchema.parse({ ...validSettings, code: 'cim' }).code).toBe('CIM');
    expect(centerSettingsSchema.safeParse({ ...validSettings, code: '' }).success).toBe(false);
    expect(centerSettingsSchema.safeParse({ ...validSettings, code: 'A' }).success).toBe(false);
    expect(centerSettingsSchema.safeParse({ ...validSettings, code: 'avec espace' }).success).toBe(false);
  });

  it('refuses a colour that is not a six-digit hex', () => {
    expect(centerSettingsSchema.safeParse({ ...validSettings, primaryColor: 'bleu' }).success).toBe(false);
    expect(centerSettingsSchema.safeParse({ ...validSettings, secondaryColor: '#12345' }).success).toBe(false);
    expect(centerSettingsSchema.safeParse({ ...validSettings, primaryColor: '#1D4ED8' }).success).toBe(true);
  });

  it('requires a timezone shaped like an IANA zone', () => {
    expect(centerSettingsSchema.parse({ ...validSettings, timezone: 'Africa/Casablanca' }).timezone).toBe('Africa/Casablanca');
    expect(centerSettingsSchema.safeParse({ ...validSettings, timezone: '' }).success).toBe(false);
    expect(centerSettingsSchema.safeParse({ ...validSettings, timezone: 'Casablanca' }).success).toBe(false);
  });

  it('refuses a logo that is not a file inside the public directory', () => {
    for (const logoPath of ['/logo.png', '/brand/centre-imam-malik.svg', '/photo.JPEG']) {
      expect(centerSettingsSchema.safeParse({ ...validSettings, logoPath }).success, logoPath).toBe(true);
    }
    for (const logoPath of ['logo.png', '../../etc/passwd', '/logo.exe', 'https://example.test/logo.png']) {
      expect(centerSettingsSchema.safeParse({ ...validSettings, logoPath }).success, logoPath).toBe(false);
    }
  });

  it('accepts a bare social handle and a full address, and refuses a spaced one', () => {
    expect(centerSettingsSchema.safeParse({ ...validSettings, facebook: 'centre.imam.malik' }).success).toBe(true);
    expect(centerSettingsSchema.safeParse({ ...validSettings, facebook: 'https://facebook.com/centre' }).success).toBe(true);
    expect(centerSettingsSchema.safeParse({ ...validSettings, website: 'une adresse' }).success).toBe(false);
  });

  it('requires a French centre name and a known default language', () => {
    expect(centerSettingsSchema.safeParse({ ...validSettings, nameFr: '' }).success).toBe(false);
    expect(centerSettingsSchema.safeParse({ ...validSettings, locale: 'en' }).success).toBe(false);
    expect(centerSettingsSchema.parse({ ...validSettings, locale: 'ar' }).locale).toBe('ar');
  });

  it('writes every key it owns, so a missing default cannot be mistaken for a cleared value', () => {
    const input = centerSettingsSchema.parse(validSettings);
    const entries = centerSettingEntries(input);
    expect(entries.map(([key]) => key).sort()).toEqual(Object.values(CENTER_SETTING_KEYS).sort());
    // An unset footer is stored as an empty value rather than deleted: `getSetting`
    // reads a missing key as its default, and the centre meant to clear it.
    expect(entries.find(([key]) => key === CENTER_SETTING_KEYS.receiptFooterFr)?.[1]).toBe('');
    expect(entries.find(([key]) => key === CENTER_SETTING_KEYS.locale)?.[1]).toBe('fr');
  });
});