import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACADEMIC_STAGE_LABELS,
  ACADEMIC_STAGES,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUSES,
  CERTIFICATE_TYPE_LABELS,
  CERTIFICATE_TYPES,
  CURRENCY,
  CURRENCY_SUFFIX,
  DEFAULT_LOCALE,
  DOCUMENT_CATEGORIES,
  EXAM_TYPES,
  GENDERS,
  LOCALES,
  MAX_UPLOAD_BYTES,
  NOTIFICATION_SEVERITIES,
  NOTIFICATION_TYPES,
  PAYMENT_KINDS,
  PAYMENT_METHOD_CODES,
  PAYMENT_METHOD_LABELS,
  PERMISSIONS,
  ROOM_STATUSES,
  ROLE_LABELS,
  ROLES,
  STUDENT_STATUS_LABELS,
  STUDENT_STATUSES,
  TRAINING_CATEGORIES,
  TRAINING_CATEGORY_LABELS,
  TRAINING_STATUSES,
  AUDIT_ACTIONS,
} from '@/lib/constants';

const labelled = (labels: Record<string, { fr: string; ar: string }>, values: readonly string[]) => {
  it('labels every value in French and Arabic', () => {
    for (const value of values) {
      const entry = labels[value];
      expect(entry, `missing label for ${value}`).toBeDefined();
      expect(entry?.fr.trim(), `empty FR label for ${value}`).not.toBe('');
      expect(entry?.ar.trim(), `empty AR label for ${value}`).not.toBe('');
    }
  });
};

labelled(ROLE_LABELS, ROLES);
labelled(STUDENT_STATUS_LABELS, STUDENT_STATUSES);
labelled(ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUSES);
labelled(PAYMENT_METHOD_LABELS, PAYMENT_METHOD_CODES);
labelled(TRAINING_CATEGORY_LABELS, TRAINING_CATEGORIES);
labelled(CERTIFICATE_TYPE_LABELS, CERTIFICATE_TYPES);
labelled(ACADEMIC_STAGE_LABELS, ACADEMIC_STAGES);

describe('student genders', () => {
  it('uses the two codes of the Moroccan school system', () => {
    expect([...GENDERS]).toEqual(['M', 'F']);
  });

  it('stores gender as a nullable column so an unspecified value is possible', () => {
    // The database must not carry a CHECK constraint that would make an
    // unknown gender impossible to record.
    const schema = readFileSync(path.join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8');
    expect(schema).toMatch(/gender\s+String\?/);
  });
});

describe('closed value sets', () => {
  it('uses upper-case snake case so the SQLite CHECK constraints stay simple', () => {
    const all = [
      ...ROLES,
      ...STUDENT_STATUSES,
      ...ATTENDANCE_STATUSES,
      ...PAYMENT_METHOD_CODES,
      ...TRAINING_CATEGORIES,
      ...CERTIFICATE_TYPES,
      ...ACADEMIC_STAGES,
      ...PAYMENT_KINDS,
      ...NOTIFICATION_TYPES,
      ...NOTIFICATION_SEVERITIES,
      ...EXAM_TYPES,
      ...ROOM_STATUSES,
      ...DOCUMENT_CATEGORIES,
      ...TRAINING_STATUSES,
      ...AUDIT_ACTIONS,
    ];
    for (const value of all) expect(value, `${value} is not upper snake case`).toMatch(/^[A-Z][A-Z0-9_]*$/);
  });

  it('has no duplicate entries', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
    expect(new Set(ROLES).size).toBe(ROLES.length);
    expect(new Set(ATTENDANCE_STATUSES).size).toBe(ATTENDANCE_STATUSES.length);
  });

  it('names permissions as resource.action', () => {
    for (const permission of PERMISSIONS) {
      expect(permission, `${permission} has no action`).toMatch(/^[a-z]+\.[a-z]+$/);
    }
  });

  it('includes the four roles the centre needs', () => {
    expect(ROLES).toEqual(['ADMIN', 'DIRECTEUR', 'SECRETARY', 'TEACHER']);
  });

  it('covers the Moroccan academic stages', () => {
    expect(ACADEMIC_STAGES).toContain('PRIMAIRE');
    expect(ACADEMIC_STAGES).toContain('COLLEGE');
    expect(ACADEMIC_STAGES).toContain('LYCEE');
    expect(ACADEMIC_STAGES).toContain('UNIVERSITE');
  });
});

describe('currency and localisation configuration', () => {
  it('uses MAD with the DH suffix required by the client', () => {
    expect(CURRENCY).toBe('MAD');
    expect(CURRENCY_SUFFIX.fr).toBe('DH');
    expect(CURRENCY_SUFFIX.ar).toBe('د.م.');
  });

  it('defaults to French with Arabic available', () => {
    expect(LOCALES).toEqual(['fr', 'ar']);
    expect(DEFAULT_LOCALE).toBe('fr');
  });

  it('caps uploads at a size an office PC can handle', () => {
    expect(MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
  });
});
