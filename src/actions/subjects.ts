'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { requirePermission } from '@/lib/auth/permissions';
import { recordChange, diffFields } from '@/lib/audit';
import { AppError, handleError, ok, type ActionResult } from '@/lib/utils/errors';
import { subjectCreateSchema, subjectUpdateSchema } from '@/lib/validation/people';
import { getSubject } from '@/lib/catalog/queries';
import { parseForm } from '@/lib/action-utils';

/**
 * Subject mutations.
 *
 * Languages are not a separate entity: a language is a subject whose
 * `isLanguage` flag is set, which is what `createSubjectAction` writes when the
 * "language" checkbox is ticked. The language screen therefore reuses this
 * action with `forceLanguage` instead of duplicating the logic.
 */

function revalidateAcademics() {
  revalidatePath('/settings/academics');
  revalidatePath('/teachers');
}

export async function createSubjectAction(
  formData: FormData,
  options: { forceLanguage?: boolean } = {},
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission('academics.manage');
    const input = parseForm(subjectCreateSchema, formData);

    const isLanguage = options.forceLanguage ? true : input.isLanguage;

    const created = await prisma.subject.create({
      data: {
        centerId: user.centerId,
        code: input.code,
        nameFr: input.nameFr,
        nameAr: input.nameAr,
        categoryId: input.categoryId || null,
        description: input.description,
        isLanguage,
        active: input.active,
      },
      select: { id: true },
    });

    await recordChange({
      user,
      action: 'CREATE',
      entity: 'Subject',
      entityId: created.id,
      metadata: { code: input.code, nameFr: input.nameFr, isLanguage },
    });

    revalidateAcademics();
    return ok({ id: created.id });
  } catch (error) {
    return handleError(error, 'createSubject');
  }
}

export async function updateSubjectAction(id: string, formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission('academics.manage');

    const existing = await getSubject(user.centerId, id);
    if (!existing) throw new AppError('NOT_FOUND', 'Matière introuvable');

    const input = parseForm(subjectUpdateSchema, formData);

    await prisma.subject.update({
      where: { id: existing.id },
      data: {
        code: input.code,
        nameFr: input.nameFr,
        nameAr: input.nameAr,
        categoryId: input.categoryId || null,
        description: input.description,
        isLanguage: input.isLanguage,
        active: input.active,
      },
    });

    await recordChange({
      user,
      action: 'UPDATE',
      entity: 'Subject',
      entityId: existing.id,
      metadata: {
        changes: diffFields(existing as unknown as Record<string, unknown>, {
          nameFr: input.nameFr,
          nameAr: input.nameAr,
          isLanguage: input.isLanguage,
          active: input.active,
        }),
      },
    });

    revalidateAcademics();
    return ok({ id: existing.id });
  } catch (error) {
    return handleError(error, 'updateSubject');
  }
}

/**
 * Deactivates a subject instead of deleting it.
 *
 * Grades, exams and schedules reference subjects. A hard delete would either
 * fail on a foreign key or, worse, cascade into a lost grade sheet, so the
 * record is always kept and only flagged inactive.
 */
export async function deleteSubjectAction(id: string): Promise<ActionResult<{ id: string; deactivated: boolean }>> {
  try {
    const user = await requirePermission('academics.manage');

    const existing = await getSubject(user.centerId, id);
    if (!existing) throw new AppError('NOT_FOUND', 'Matière introuvable');

    await prisma.subject.update({ where: { id: existing.id }, data: { active: false } });

    await recordChange({
      user,
      action: 'DELETE',
      entity: 'Subject',
      entityId: existing.id,
      metadata: { code: existing.code, nameFr: existing.nameFr, soft: true, reason: 'deactivated' },
    });

    revalidateAcademics();
    return ok({ id: existing.id, deactivated: true });
  } catch (error) {
    return handleError(error, 'deleteSubject');
  }
}

/**
 * Reactivates a deactivated catalogue row.
 *
 * The four delegates are called through an explicit branch rather than a
 * lookup table: their Prisma signatures differ enough that a union of them is
 * not callable, and the `centerId` check is repeated in each branch precisely
 * so no branch can be forgotten.
 */
export async function restoreCatalogItemAction(
  entity: 'Subject' | 'AcademicLevel' | 'Service' | 'Room',
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission('academics.manage');

    if (entity === 'Subject') {
      const existing = await prisma.subject.findFirst({
        where: { id, centerId: user.centerId },
        select: { id: true },
      });
      if (!existing) throw new AppError('NOT_FOUND', 'Matière introuvable');
      await prisma.subject.update({ where: { id: existing.id }, data: { active: true } });
    } else if (entity === 'AcademicLevel') {
      const existing = await prisma.academicLevel.findFirst({
        where: { id, centerId: user.centerId },
        select: { id: true },
      });
      if (!existing) throw new AppError('NOT_FOUND', 'Niveau introuvable');
      await prisma.academicLevel.update({ where: { id: existing.id }, data: { active: true } });
    } else if (entity === 'Service') {
      const existing = await prisma.service.findFirst({
        where: { id, centerId: user.centerId },
        select: { id: true },
      });
      if (!existing) throw new AppError('NOT_FOUND', 'Service introuvable');
      await prisma.service.update({ where: { id: existing.id }, data: { active: true } });
    } else {
      const existing = await prisma.room.findFirst({
        where: { id, centerId: user.centerId },
        select: { id: true },
      });
      if (!existing) throw new AppError('NOT_FOUND', 'Salle introuvable');
      await prisma.room.update({ where: { id: existing.id }, data: { active: true } });
    }

    await recordChange({ user, action: 'RESTORE', entity, entityId: id });

    revalidatePath('/settings/academics');
    revalidatePath('/settings/services');
    revalidatePath('/settings/rooms');
    return ok({ id });
  } catch (error) {
    return handleError(error, 'restoreCatalogItem');
  }
}
