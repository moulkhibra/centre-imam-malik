'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { requirePermission } from '@/lib/auth/permissions';
import { recordChange, diffFields } from '@/lib/audit';
import { AppError, handleError, ok, type ActionResult } from '@/lib/utils/errors';
import { teacherCreateSchema, teacherUpdateSchema } from '@/lib/validation/people';
import { getTeacher } from '@/lib/people/queries';
import { nextCode, parseForm, toDate } from '@/lib/action-utils';

/**
 * Teacher mutations.
 *
 * A secretary holds `teachers.view` but not `teachers.create` / `.update` /
 * `.delete`, so those three actions are refused on the server for that role
 * even though the buttons are hidden in the interface.
 */

function revalidateTeacherViews() {
  revalidatePath('/teachers');
  revalidatePath('/dashboard');
}

async function nextTeacherCode(centerId: string): Promise<string> {
  const rows = await prisma.teacher.findMany({
    where: { centerId, code: { startsWith: 'ENS-' } },
    select: { code: true },
  });
  return nextCode(
    rows.map((row) => row.code),
    'ENS-',
  );
}

export async function createTeacherAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission('teachers.create');
    const input = parseForm(teacherCreateSchema, formData);
    const code = input.code ?? (await nextTeacherCode(user.centerId));

    const created = await prisma.teacher.create({
      data: {
        centerId: user.centerId,
        code,
        firstName: input.firstName,
        lastName: input.lastName,
        firstNameAr: input.firstNameAr,
        lastNameAr: input.lastNameAr,
        phone: input.phone,
        whatsapp: input.whatsapp,
        email: input.email,
        cin: input.cin,
        specialization: input.specialization,
        bio: input.bio,
        hiredAt: toDate(input.hiredAt),
        status: input.status,
        notes: input.notes,
      },
      select: { id: true },
    });

    await recordChange({
      user,
      action: 'CREATE',
      entity: 'Teacher',
      entityId: created.id,
      metadata: { code, lastName: input.lastName, firstName: input.firstName },
    });

    revalidateTeacherViews();
    return ok({ id: created.id });
  } catch (error) {
    return handleError(error, 'createTeacher');
  }
}

export async function updateTeacherAction(id: string, formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission('teachers.update');

    const existing = await getTeacher(user.centerId, id);
    if (!existing) throw new AppError('NOT_FOUND', 'Enseignant introuvable');

    const input = parseForm(teacherUpdateSchema, formData);

    await prisma.teacher.update({
      where: { id: existing.id },
      data: {
        ...(input.code ? { code: input.code } : {}),
        firstName: input.firstName,
        lastName: input.lastName,
        firstNameAr: input.firstNameAr,
        lastNameAr: input.lastNameAr,
        phone: input.phone,
        whatsapp: input.whatsapp,
        email: input.email,
        cin: input.cin,
        specialization: input.specialization,
        bio: input.bio,
        hiredAt: toDate(input.hiredAt),
        status: input.status,
        notes: input.notes,
      },
    });

    await recordChange({
      user,
      action: 'UPDATE',
      entity: 'Teacher',
      entityId: existing.id,
      metadata: {
        changes: diffFields(existing as unknown as Record<string, unknown>, {
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          email: input.email,
          status: input.status,
        }),
      },
    });

    revalidateTeacherViews();
    return ok({ id: existing.id });
  } catch (error) {
    return handleError(error, 'updateTeacher');
  }
}

/**
 * Soft-deletes a teacher, refusing while the teacher is still assigned to a
 * group or a schedule: the groups would be left without a holder.
 */
export async function deleteTeacherAction(id: string, confirmCode: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission('teachers.delete');

    const existing = await getTeacher(user.centerId, id);
    if (!existing) throw new AppError('NOT_FOUND', 'Enseignant introuvable');

    if (!confirmCode.trim()) {
      throw new AppError('VALIDATION', 'Confirmation requise', {
        confirmCode: ['Saisissez le code pour confirmer'],
      });
    }

    const groups = await prisma.group.count({ where: { teacherId: existing.id } });
    if (groups > 0) {
      throw new AppError(
        'CONFLICT',
        `Cet enseignant est encore responsable de ${groups} groupe(s). Réaffectez-les avant de le supprimer.`,
      );
    }

    await prisma.teacher.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });

    await recordChange({
      user,
      action: 'DELETE',
      entity: 'Teacher',
      entityId: existing.id,
      metadata: { code: existing.code, lastName: existing.lastName, soft: true },
    });

    revalidateTeacherViews();
    return ok({ id: existing.id });
  } catch (error) {
    return handleError(error, 'deleteTeacher');
  }
}
