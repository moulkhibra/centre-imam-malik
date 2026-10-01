'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { requirePermission } from '@/lib/auth/permissions';
import { recordChange, diffFields } from '@/lib/audit';
import { AppError, handleError, ok, type ActionResult } from '@/lib/utils/errors';
import { parentCreateSchema, parentUpdateSchema } from '@/lib/validation/people';
import { getParent } from '@/lib/people/queries';
import { nextCode, parseForm, requireConfirmation } from '@/lib/action-utils';

/**
 * Parent mutations. Same contract as `src/actions/students.ts`: server-side
 * permission check, Zod validation, audit entry, typed error result.
 */

function revalidateParentViews() {
  revalidatePath('/parents');
  revalidatePath('/students');
  revalidatePath('/dashboard');
}

async function nextParentCode(centerId: string): Promise<string> {
  const rows = await prisma.parent.findMany({
    where: { centerId, code: { startsWith: 'PAR-' } },
    select: { code: true },
  });
  return nextCode(
    rows.map((row) => row.code),
    'PAR-',
  );
}

export async function createParentAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission('parents.create');
    const input = parseForm(parentCreateSchema, formData);
    const code = input.code ?? (await nextParentCode(user.centerId));

    const created = await prisma.parent.create({
      data: {
        centerId: user.centerId,
        code,
        firstName: input.firstName,
        lastName: input.lastName,
        cin: input.cin,
        phone: input.phone,
        whatsapp: input.whatsapp,
        email: input.email,
        address: input.address,
        city: input.city,
        relation: input.relation,
        notes: input.notes,
      },
      select: { id: true },
    });

    await recordChange({
      user,
      action: 'CREATE',
      entity: 'Parent',
      entityId: created.id,
      metadata: { code, lastName: input.lastName, firstName: input.firstName },
    });

    revalidateParentViews();
    return ok({ id: created.id });
  } catch (error) {
    return handleError(error, 'createParent');
  }
}

export async function updateParentAction(id: string, formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission('parents.update');

    const existing = await getParent(user.centerId, id);
    if (!existing) throw new AppError('NOT_FOUND', 'Parent introuvable');

    const input = parseForm(parentUpdateSchema, formData);

    await prisma.parent.update({
      where: { id: existing.id },
      data: {
        ...(input.code ? { code: input.code } : {}),
        firstName: input.firstName,
        lastName: input.lastName,
        cin: input.cin,
        phone: input.phone,
        whatsapp: input.whatsapp,
        email: input.email,
        address: input.address,
        city: input.city,
        relation: input.relation,
        notes: input.notes,
      },
    });

    await recordChange({
      user,
      action: 'UPDATE',
      entity: 'Parent',
      entityId: existing.id,
      metadata: {
        changes: diffFields(existing as unknown as Record<string, unknown>, {
          firstName: input.firstName,
          lastName: input.lastName,
          cin: input.cin,
          phone: input.phone,
        }),
      },
    });

    revalidateParentViews();
    return ok({ id: existing.id });
  } catch (error) {
    return handleError(error, 'updateParent');
  }
}

/**
 * Soft-deletes a parent.
 *
 * Refuses while the parent is still linked to a student: removing the contact
 * would orphan the registration trail of a minor. The secretary must unlink
 * the students first, which keeps the deletion deliberate.
 */
export async function deleteParentAction(id: string, confirmCode: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission('parents.delete');

    const existing = await getParent(user.centerId, id);
    if (!existing) throw new AppError('NOT_FOUND', 'Parent introuvable');

    requireConfirmation(existing, confirmCode);

    const linked = await prisma.studentParent.count({
      where: { parentId: existing.id, student: { deletedAt: null } },
    });
    if (linked > 0) {
      throw new AppError(
        'CONFLICT',
        `Ce parent est encore lié à ${linked} élève(s). Dissociez-les avant de le supprimer.`,
      );
    }

    await prisma.parent.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });

    await recordChange({
      user,
      action: 'DELETE',
      entity: 'Parent',
      entityId: existing.id,
      metadata: { code: existing.code, lastName: existing.lastName, soft: true },
    });

    revalidateParentViews();
    return ok({ id: existing.id });
  } catch (error) {
    return handleError(error, 'deleteParent');
  }
}
