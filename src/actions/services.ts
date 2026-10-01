'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { requirePermission } from '@/lib/auth/permissions';
import { recordChange, diffFields } from '@/lib/audit';
import { AppError, handleError, ok, type ActionResult } from '@/lib/utils/errors';
import { serviceCreateSchema, serviceUpdateSchema } from '@/lib/validation/people';
import { getService } from '@/lib/catalog/queries';
import { parseForm } from '@/lib/action-utils';

/**
 * Service catalogue mutations, guarded by `academics.manage`.
 *
 * A service is deactivated rather than deleted: registrations and invoices
 * already reference it by id, and those rows must keep their label.
 */

function revalidateServices() {
  revalidatePath('/settings/services');
}

export async function createServiceAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission('academics.manage');
    const input = parseForm(serviceCreateSchema, formData);

    const created = await prisma.service.create({
      data: {
        centerId: user.centerId,
        code: input.code,
        nameFr: input.nameFr,
        nameAr: input.nameAr,
        description: input.description,
        defaultPriceCents: input.defaultPriceCents,
        defaultDurationMinutes: input.defaultDurationMinutes,
        active: input.active,
      },
      select: { id: true },
    });

    await recordChange({
      user,
      action: 'CREATE',
      entity: 'Service',
      entityId: created.id,
      metadata: { code: input.code, nameFr: input.nameFr, defaultPriceCents: input.defaultPriceCents },
    });

    revalidateServices();
    return ok({ id: created.id });
  } catch (error) {
    return handleError(error, 'createService');
  }
}

export async function updateServiceAction(id: string, formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission('academics.manage');

    const existing = await getService(user.centerId, id);
    if (!existing) throw new AppError('NOT_FOUND', 'Service introuvable');

    const input = parseForm(serviceUpdateSchema, formData);

    await prisma.service.update({
      where: { id: existing.id },
      data: {
        code: input.code,
        nameFr: input.nameFr,
        nameAr: input.nameAr,
        description: input.description,
        defaultPriceCents: input.defaultPriceCents,
        defaultDurationMinutes: input.defaultDurationMinutes,
        active: input.active,
      },
    });

    await recordChange({
      user,
      action: 'UPDATE',
      entity: 'Service',
      entityId: existing.id,
      metadata: {
        changes: diffFields(existing as unknown as Record<string, unknown>, {
          nameFr: input.nameFr,
          nameAr: input.nameAr,
          defaultPriceCents: input.defaultPriceCents,
          active: input.active,
        }),
      },
    });

    revalidateServices();
    return ok({ id: existing.id });
  } catch (error) {
    return handleError(error, 'updateService');
  }
}

export async function deleteServiceAction(id: string): Promise<ActionResult<{ id: string; deactivated: boolean }>> {
  try {
    const user = await requirePermission('academics.manage');

    const existing = await getService(user.centerId, id);
    if (!existing) throw new AppError('NOT_FOUND', 'Service introuvable');

    // Registrations and invoices keep the service id, so a service is never
    // really deleted: the row is deactivated and stays listed with a restore
    // button. The group count is only recorded in the audit trail to explain the
    // deactivation, which is why `deactivated` is always true here.
    const groups = await prisma.group.count({ where: { serviceId: existing.id } });

    await prisma.service.update({ where: { id: existing.id }, data: { active: false } });
    await recordChange({
      user,
      action: 'DELETE',
      entity: 'Service',
      entityId: existing.id,
      metadata: { code: existing.code, soft: true, reason: 'deactivated', groups },
    });

    revalidateServices();
    return ok({ id: existing.id, deactivated: true });
  } catch (error) {
    return handleError(error, 'deleteService');
  }
}
