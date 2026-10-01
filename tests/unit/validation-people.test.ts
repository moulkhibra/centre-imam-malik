import { describe, expect, it } from 'vitest';
import {
  catalogFilterSchema,
  levelCreateSchema,
  parentCreateSchema,
  parentFilterSchema,
  roomCreateSchema,
  serviceCreateSchema,
  studentCreateSchema,
  studentFilterSchema,
  studentUpdateSchema,
  subjectCreateSchema,
  teacherCreateSchema,
  teacherFilterSchema,
} from '@/lib/validation/people';

/**
 * Validation of the Phase 2 records.
 *
 * These schemas are parsed twice - once by the form, once by the Server Action -
 * so what is asserted here is what actually reaches the database. The recurring
 * theme is that an unset optional field must arrive as `null`, never as an empty
 * string: the columns are nullable, and '' would make a search for "no value"
 * miss the row.
 */
const validStudent = {
  firstName: 'Amine',
  lastName: 'El Amrani',
  status: 'ACTIVE',
};

describe('student schema', () => {
  it('accepts a minimal record and defaults the status', () => {
    const parsed = studentCreateSchema.parse({ firstName: 'Amine', lastName: 'El Amrani' });
    expect(parsed.status).toBe('ACTIVE');
  });

  it('requires a usable name', () => {
    expect(studentCreateSchema.safeParse({ ...validStudent, firstName: 'A' }).success).toBe(false);
    expect(studentCreateSchema.safeParse({ ...validStudent, firstName: '' }).success).toBe(false);
    expect(studentCreateSchema.safeParse({ ...validStudent, lastName: '1' }).success).toBe(false);
  });

  it('accepts a name carrying an accent, an apostrophe or a second Latin script', () => {
    expect(studentCreateSchema.safeParse({ ...validStudent, firstName: 'Éloïse', lastName: "O'Brien" }).success).toBe(true);
    expect(studentCreateSchema.safeParse({ ...validStudent, lastName: 'Muñoz' }).success).toBe(true);
  });

  it('normalises an empty optional field to null', () => {
    const parsed = studentCreateSchema.parse({ ...validStudent, phone: '', city: '  ', cin: '' });
    expect(parsed.phone).toBeNull();
    expect(parsed.city).toBeNull();
    expect(parsed.cin).toBeNull();
  });

  it('keeps the Arabic name, which the schema allows to be absent', () => {
    expect(studentCreateSchema.parse({ ...validStudent, firstNameAr: '' }).firstNameAr).toBeNull();
    expect(studentCreateSchema.parse({ ...validStudent, firstNameAr: 'أمين' }).firstNameAr).toBe('أمين');
  });

  it('rejects an impossible birth date and one from the future', () => {
    expect(studentCreateSchema.safeParse({ ...validStudent, birthDate: '2020-02-31' }).success).toBe(false);
    expect(studentCreateSchema.safeParse({ ...validStudent, birthDate: '01/03/2015' }).success).toBe(false);
    expect(studentCreateSchema.safeParse({ ...validStudent, birthDate: '2999-01-01' }).success).toBe(false);
    expect(studentCreateSchema.safeParse({ ...validStudent, birthDate: '' }).success).toBe(true);
    expect(studentCreateSchema.safeParse({ ...validStudent, birthDate: '2015-03-01' }).success).toBe(true);
  });

  it('upper-cases a code and refuses one the centre cannot read aloud', () => {
    expect(studentCreateSchema.parse({ ...validStudent, code: 'ele-12' }).code).toBe('ELE-12');
    expect(studentCreateSchema.safeParse({ ...validStudent, code: 'ELE 12' }).success).toBe(false);
    expect(studentCreateSchema.safeParse({ ...validStudent, code: '-ELE' }).success).toBe(false);
    expect(studentCreateSchema.parse({ ...validStudent, code: '' }).code).toBeNull();
  });

  it('refuses a status outside the declared set', () => {
    expect(studentCreateSchema.safeParse({ ...validStudent, status: 'ENROLLED' }).success).toBe(false);
  });

  it('refuses to blank both names on an update', () => {
    // `studentUpdateSchema` is the create schema, so firstName and lastName stay
    // mandatory: an all-blank form must fail rather than wipe the record.
    expect(studentUpdateSchema.safeParse({ firstName: '', lastName: '' }).success).toBe(false);
    expect(studentUpdateSchema.safeParse(validStudent).success).toBe(true);
  });
});

describe('parent schema', () => {
  const valid = { firstName: 'Nadia', lastName: 'Bennani' };

  it('accepts the minimal record and normalises the blanks', () => {
    const parsed = parentCreateSchema.parse({ ...valid, whatsapp: '', relation: '' });
    expect(parsed.whatsapp).toBeNull();
    expect(parsed.relation).toBeNull();
  });

  it('has no filter of its own yet, and drops any key it is given', () => {
    // ParentsView renders no filter. Zod strips unknown keys instead of
    // rejecting them, so a hand-edited `?status=ACTIVE` on /parents parses away
    // to an empty filter and the query ignores it rather than half-applying it.
    // That is asserted here so the day a filter is added, this test is the one
    // that has to change.
    expect(parentFilterSchema.parse({})).toEqual({});
    expect(parentFilterSchema.parse({ status: 'ACTIVE', gender: 'F' })).toEqual({});
  });
});

describe('teacher schema', () => {
  it('accepts the minimal record', () => {
    const parsed = teacherCreateSchema.parse({ firstName: 'Youssef', lastName: 'Idrissi' });
    expect(parsed.status).toBe('ACTIVE');
    expect(parsed.hiredAt).toBeNull();
  });

  it('accepts a free-text biography', () => {
    expect(teacherCreateSchema.safeParse({ firstName: 'Y', lastName: 'Idrissi', bio: 'x'.repeat(1000) }).success).toBe(false);
    expect(teacherCreateSchema.safeParse({ firstName: 'Youssef', lastName: 'Idrissi', bio: 'Professeur de mathématiques' }).success).toBe(true);
  });
});

describe('catalogue schemas', () => {
  it('requires a code for a level, a subject and a service, but not for a room', () => {
    expect(levelCreateSchema.safeParse({ stage: 'PRIMAIRE', nameFr: '1ère année' }).success).toBe(false);
    expect(subjectCreateSchema.safeParse({ nameFr: 'Mathématiques' }).success).toBe(false);
    expect(serviceCreateSchema.safeParse({ nameFr: 'Soutien scolaire' }).success).toBe(false);
    // A room is identified by its name: the schema has no code column at all.
    expect(roomCreateSchema.safeParse({ name: 'Salle 1' }).success).toBe(true);
  });

  it('defaults a level order, a subject flag and a room availability', () => {
    expect(levelCreateSchema.parse({ code: 'PR-1', stage: 'PRIMAIRE', nameFr: '1ère année' }).sortOrder).toBe(0);
    expect(subjectCreateSchema.parse({ code: 'MATH', nameFr: 'Mathématiques' }).isLanguage).toBe(false);
    expect(roomCreateSchema.parse({ name: 'Salle 1' }).status).toBe('AVAILABLE');
  });

  it('refuses a negative capacity, price or duration', () => {
    expect(roomCreateSchema.safeParse({ name: 'Salle 1', capacity: -5 }).success).toBe(false);
    expect(serviceCreateSchema.safeParse({ code: 'S-1', nameFr: 'Soutien', defaultPriceCents: -1 }).success).toBe(false);
    expect(serviceCreateSchema.safeParse({ code: 'S-1', nameFr: 'Soutien', defaultDurationMinutes: -30 }).success).toBe(false);
  });

  it('refuses a stage or a room status outside the declared set', () => {
    expect(levelCreateSchema.safeParse({ code: 'X', stage: 'KINDERGARTEN', nameFr: 'Petite section' }).success).toBe(false);
    expect(roomCreateSchema.safeParse({ name: 'Salle 1', status: 'OPEN' }).success).toBe(false);
    expect(roomCreateSchema.safeParse({ name: 'Salle 1', status: 'MAINTENANCE' }).success).toBe(true);
  });

  it('reads the paired hidden checkbox as a real boolean', () => {
    // Every form pairs a hidden `value=""` with the checkbox, so `'true'` and `''`
    // are exactly what arrives on submit.
    expect(levelCreateSchema.parse({ code: 'PR-1', stage: 'LYCEE', nameFr: 'Tronc commun', active: 'true' }).active).toBe(true);
    expect(levelCreateSchema.parse({ code: 'PR-1', stage: 'LYCEE', nameFr: 'Tronc commun', active: '' }).active).toBe(false);
  });
});

describe('list filters', () => {
  it('treats ALL as the neutral value and falls back to it', () => {
    expect(studentFilterSchema.parse({ status: 'ALL', gender: 'ALL' })).toMatchObject({ status: 'ALL', gender: 'ALL' });
    expect(studentFilterSchema.parse({ status: 'nonsense' })).toMatchObject({ status: 'ALL' });
    expect(studentFilterSchema.parse({})).toMatchObject({ status: 'ALL', gender: 'ALL', level: '' });
  });

  it('accepts a real status and gender', () => {
    expect(studentFilterSchema.parse({ status: 'SUSPENDED', gender: 'F' })).toMatchObject({ status: 'SUSPENDED', gender: 'F' });
  });

  it('models the catalogue filter as true / false / ALL', () => {
    expect(catalogFilterSchema.parse({ active: 'false' })).toMatchObject({ active: 'false' });
    expect(catalogFilterSchema.parse({ active: 'maybe' })).toMatchObject({ active: 'ALL' });
    expect(catalogFilterSchema.parse({})).toMatchObject({ active: 'ALL', stage: '' });
  });

  it('gives teachers a status filter and no gender', () => {
    expect(teacherFilterSchema.parse({ status: 'ACTIVE' })).toMatchObject({ status: 'ACTIVE' });
    expect(Object.keys(teacherFilterSchema.parse({}))).toEqual(['status']);
  });
});
