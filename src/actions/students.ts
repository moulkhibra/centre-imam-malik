'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { requirePermission } from '@/lib/auth/permissions';
import { recordChange, diffFields } from '@/lib/audit';
import { AppError, handleError, ok, type ActionResult } from '@/lib/utils/errors';
import { studentCreateSchema, studentUpdateSchema, type StudentInput } from '@/lib/validation/people';
import { getStudent } from '@/lib/people/queries';
import { nextCode, parseForm, requireConfirmation, toDate } from '@/lib/action-utils';

/**
 * Student mutations.
 *
 * Every exported action repeats the same three steps, in this order:
 *
 *   1. `requirePermission(...)` - the authorization decision happens on the
 *      server, against the session, before any input is looked at. The UI hides
 *      buttons a secretary cannot use, but that is presentation only.
 *   2. `schema.parse(...)` - the same Zod schema the form used, re-run here.
 *   3. `recordChange(...)` - the journal entry, written next to the write.
 *
 * Every action catches its own errors and returns an `ActionResult`, so a
 * duplicate CIN or an unreachable database is a message on the form rather than
 * a crash on the page.
 */

function revalidateStudentViews() {
  revalidatePath('/students');
  revalidatePath('/dashboard');
}

async function nextStudentCode(centerId: string): Promise<string> {
  const rows = await prisma.student.findMany({
    where: { centerId, code: { startsWith: 'ELE-' } },
    select: { code: true },
  });
  return nextCode(
    rows.map((row) => row.code),
    'ELE-',
  );
}

export async function createStudentAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission('students.create');
    const input = parseForm(studentCreateSchema, formData);

    // A blank code becomes a generated one; an explicit code is kept as typed.
    const code = input.code ?? (await nextStudentCode(user.centerId));

    const created = await prisma.student.create({
      data: {
        centerId: user.centerId,
        code,
        firstName: input.firstName,
        lastName: input.lastName,
        firstNameAr: input.firstNameAr,
        lastNameAr: input.lastNameAr,
        birthDate: toDate(input.birthDate),
        gender: input.gender ?? null,
        cin: input.cin,
        phone: input.phone,
        whatsapp: input.whatsapp,
        email: input.email,
        address: input.address,
        city: input.city,
        school: input.school,
        levelId: input.levelId || null,
        emergencyContactName: input.emergencyContactName,
        emergencyContactPhone: input.emergencyContactPhone,
        notes: input.notes,
        status: input.status,
      },
      select: { id: true },
    });

    await recordChange({
      user,
      action: 'CREATE',
      entity: 'Student',
      entityId: created.id,
      metadata: { code, lastName: input.lastName, firstName: input.firstName },
    });

    revalidateStudentViews();
    return ok({ id: created.id });
  } catch (error) {
    return handleError(error, 'createStudent');
  }
}

export async function updateStudentAction(id: string, formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission('students.update');

    const existing = await getStudent(user.centerId, id);
    if (!existing) throw new AppError('NOT_FOUND', 'Élève introuvable');

    const input = parseForm(studentUpdateSchema, formData);

    await prisma.student.update({
      where: { id: existing.id },
      data: {
        // `code: null` would clear a code the user cannot see; only send the
        // field when a value was actually submitted.
        ...(input.code ? { code: input.code } : {}),
        firstName: input.firstName,
        lastName: input.lastName,
        firstNameAr: input.firstNameAr,
        lastNameAr: input.lastNameAr,
        birthDate: toDate(input.birthDate),
        gender: input.gender ?? null,
        cin: input.cin,
        phone: input.phone,
        whatsapp: input.whatsapp,
        email: input.email,
        address: input.address,
        city: input.city,
        school: input.school,
        levelId: input.levelId || null,
        emergencyContactName: input.emergencyContactName,
        emergencyContactPhone: input.emergencyContactPhone,
        notes: input.notes,
        status: input.status,
      },
    });

    const changes = diffFields(existing as unknown as Record<string, unknown>, {
      firstName: input.firstName,
      lastName: input.lastName,
      cin: input.cin,
      phone: input.phone,
      status: input.status,
      levelId: input.levelId || null,
    });

    await recordChange({
      user,
      action: 'UPDATE',
      entity: 'Student',
      entityId: existing.id,
      metadata: { changes },
    });

    revalidateStudentViews();
    return ok({ id: existing.id });
  } catch (error) {
    return handleError(error, 'updateStudent');
  }
}

/**
 * Soft-deletes a student.
 *
 * `deletedAt` is set instead of removing the row: the record is referenced by
 * invoices, attendance and grades, and an audit trail that vanishes with the
 * data is not an audit trail. A confirmation token is required so a stray
 * request cannot delete a record, and the row is only found within the
 * caller's own centre.
 */
export async function deleteStudentAction(
  id: string,
  confirmCode: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission('students.delete');

    const existing = await getStudent(user.centerId, id);
    if (!existing) throw new AppError('NOT_FOUND', 'Élève introuvable');

    requireConfirmation(existing, confirmCode);

    await prisma.student.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    await recordChange({
      user,
      action: 'DELETE',
      entity: 'Student',
      entityId: existing.id,
      metadata: { code: existing.code, lastName: existing.lastName, soft: true },
    });

    revalidateStudentViews();
    return ok({ id: existing.id });
  } catch (error) {
    return handleError(error, 'deleteStudent');
  }
}

export type { StudentInput };
