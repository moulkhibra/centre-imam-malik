'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { requirePermission } from '@/lib/auth/permissions';
import { recordChange, diffFields } from '@/lib/audit';
import { AppError, handleError, ok, type ActionResult } from '@/lib/utils/errors';
import { roomCreateSchema, roomUpdateSchema } from '@/lib/validation/people';
import { getRoom } from '@/lib/catalog/queries';
import { parseForm } from '@/lib/action-utils';

/**
 * Room mutations, guarded by `academics.manage`.
 *
 * Rooms are referenced by groups and schedules, so removal is always a
 * deactivation. The availability status (`status`) is a separate, free
 * dimension: a room can be `MAINTENANCE` while still active in the catalogue.
 */

function revalidateRooms() {
  revalidatePath('/settings/rooms');
}

export async function createRoomAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission('academics.manage');
    const input = parseForm(roomCreateSchema, formData);

    const created = await prisma.room.create({
      data: {
        centerId: user.centerId,
        name: input.name,
        capacity: input.capacity,
        location: input.location,
        equipment: input.equipment,
        status: input.status,
        notes: input.notes,
        active: input.active,
      },
      select: { id: true },
    });

    await recordChange({
      user,
      action: 'CREATE',
      entity: 'Room',
      entityId: created.id,
      metadata: { name: input.name, capacity: input.capacity, status: input.status },
    });

    revalidateRooms();
    return ok({ id: created.id });
  } catch (error) {
    return handleError(error, 'createRoom');
  }
}

export async function updateRoomAction(id: string, formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission('academics.manage');

    const existing = await getRoom(user.centerId, id);
    if (!existing) throw new AppError('NOT_FOUND', 'Salle introuvable');

    const input = parseForm(roomUpdateSchema, formData);

    await prisma.room.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        capacity: input.capacity,
        location: input.location,
        equipment: input.equipment,
        status: input.status,
        notes: input.notes,
        active: input.active,
      },
    });

    await recordChange({
      user,
      action: 'UPDATE',
      entity: 'Room',
      entityId: existing.id,
      metadata: {
        changes: diffFields(existing as unknown as Record<string, unknown>, {
          name: input.name,
          capacity: input.capacity,
          status: input.status,
          active: input.active,
        }),
      },
    });

    revalidateRooms();
    return ok({ id: existing.id });
  } catch (error) {
    return handleError(error, 'updateRoom');
  }
}

export async function deleteRoomAction(id: string): Promise<ActionResult<{ id: string; deactivated: boolean }>> {
  try {
    const user = await requirePermission('academics.manage');

    const existing = await getRoom(user.centerId, id);
    if (!existing) throw new AppError('NOT_FOUND', 'Salle introuvable');

    await prisma.room.update({ where: { id: existing.id }, data: { active: false } });

    await recordChange({
      user,
      action: 'DELETE',
      entity: 'Room',
      entityId: existing.id,
      metadata: { name: existing.name, soft: true, reason: 'deactivated' },
    });

    revalidateRooms();
    return ok({ id: existing.id, deactivated: true });
  } catch (error) {
    return handleError(error, 'deleteRoom');
  }
}
