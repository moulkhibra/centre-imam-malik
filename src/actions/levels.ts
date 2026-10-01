'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { requirePermission } from '@/lib/auth/permissions';
import { recordChange, diffFields } from '@/lib/audit';
import { AppError, handleError, ok, type ActionResult } from '@/lib/utils/errors';
import { levelCreateSchema, levelUpdateSchema } from '@/lib/validation/people';
import { getLevel } from '@/lib/catalog/queries';
import { parseForm } from '@/lib/action-utils';

/**
 * Academic level mutations.
 *
 * Guarded by `academics.manage`, which the permission matrix grants to ADMIN
 * and DIRECTEUR only: a secretary can read the levels to fill a student form
 * but cannot silently rewrite the academic structure.
 *
 * Deletion is refused while students are enrolled, and deactivation (`active`)
 * is the intended way to retire a level.
 */

function revalidateAcademics() {
  revalidatePath('/settings/academics');
  revalidatePath('/students');
}

export async function createLevelAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission('academics.manage');
    const input = parseForm(levelCreateSchema, formData);

    const created = await prisma.academicLevel.create({
      data: {
        centerId: user.centerId,
        code: input.code,
        stage: input.stage,
        nameFr: input.nameFr,
        nameAr: input.nameAr,
        sortOrder: input.sortOrder,
        active: input.active,
      },
      select: { id: true },
    });

    await recordChange({
      user,
      action: 'CREATE',
      entity: 'AcademicLevel',
      entityId: created.id,
      metadata: { code: input.code, nameFr: input.nameFr },
    });

    revalidateAcademics();
    return ok({ id: created.id });
  } catch (error) {
    return handleError(error, 'createLevel');
  }
}

export async function updateLevelAction(id: string, formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission('academics.manage');

    const existing = await getLevel(user.centerId, id);
    if (!existing) throw new AppError('NOT_FOUND', 'Niveau introuvable');

    const input = parseForm(levelUpdateSchema, formData);

    await prisma.academicLevel.update({
      where: { id: existing.id },
      data: {
        code: input.code,
        stage: input.stage,
        nameFr: input.nameFr,
        nameAr: input.nameAr,
        sortOrder: input.sortOrder,
        active: input.active,
      },
    });

    await recordChange({
      user,
      action: 'UPDATE',
      entity: 'AcademicLevel',
      entityId: existing.id,
      metadata: {
        changes: diffFields(existing as unknown as Record<string, unknown>, {
          nameFr: input.nameFr,
          nameAr: input.nameAr,
          stage: input.stage,
          active: input.active,
        }),
      },
    });

    revalidateAcademics();
    return ok({ id: existing.id });
  } catch (error) {
    return handleError(error, 'updateLevel');
  }
}

/**
 * Deletes a level, or deactivates it when students are still enrolled.
 *
 * `Student.levelId` is `onDelete: SetNull`, so a hard delete would silently
 * clear the level of every enrolled student. Instead the level is marked
 * inactive and reported back as such, which keeps the data intact.
 */
export async function deleteLevelAction(id: string): Promise<ActionResult<{ id: string; deactivated: boolean }>> {
  try {
    const user = await requirePermission('academics.manage');

    const existing = await getLevel(user.centerId, id);
    if (!existing) throw new AppError('NOT_FOUND', 'Niveau introuvable');

    const students = await prisma.student.count({
      where: { levelId: existing.id, deletedAt: null },
    });

    if (students > 0) {
      await prisma.academicLevel.update({ where: { id: existing.id }, data: { active: false } });
      await recordChange({
        user,
        action: 'DELETE',
        entity: 'AcademicLevel',
        entityId: existing.id,
        metadata: { code: existing.code, soft: true, reason: 'deactivated', students },
      });
      revalidateAcademics();
      return ok({ id: existing.id, deactivated: true });
    }

    await prisma.academicLevel.delete({ where: { id: existing.id } });
    await recordChange({
      user,
      action: 'DELETE',
      entity: 'AcademicLevel',
      entityId: existing.id,
      metadata: { code: existing.code, soft: false },
    });

    revalidateAcademics();
    return ok({ id: existing.id, deactivated: false });
  } catch (error) {
    return handleError(error, 'deleteLevel');
  }
}
