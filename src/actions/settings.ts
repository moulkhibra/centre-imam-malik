'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { requirePermission } from '@/lib/auth/permissions';
import { recordChange, diffFields } from '@/lib/audit';
import { AppError, handleError, ok, type ActionResult } from '@/lib/utils/errors';
import { ekey } from '@/lib/validation/messages';
import { parseForm } from '@/lib/action-utils';
import {
  centerSettingEntries,
  centerSettingsSchema,
  type CenterSettingsInput,
} from '@/lib/validation/settings';
import { DEFAULT_CENTER_SETTINGS } from '@/lib/settings/defaults';

/**
 * Centre settings mutations (Phase 2B).
 *
 * One action writes both destinations the screen owns - the `Center` columns and
 * the `CenterSetting` rows - inside a single transaction. Splitting them would
 * let a rejected footers row leave the name of the centre already changed, and
 * the administrator would have no way to tell which half was saved.
 *
 * The centre written is `user.centerId`, never "the active one": the settings of
 * the centre an administrator belongs to are the ones they are allowed to edit,
 * and a lookup by `active` would let the wrong row be written the day a second
 * centre is installed.
 */

function revalidateSettingsViews() {
  revalidatePath('/settings');
  revalidatePath('/', 'layout');
}

/** The current value of every key this screen owns, for the audit diff. */
async function currentSettingValues(centerId: string): Promise<Record<string, string>> {
  const rows = await prisma.centerSetting.findMany({
    where: { centerId },
    select: { key: true, value: true },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const current: Record<string, string> = {};
  for (const [key, fallback] of Object.entries(DEFAULT_CENTER_SETTINGS)) {
    current[key] = map.get(key) ?? fallback;
  }
  return current;
}

export async function updateCenterSettingsAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requirePermission('settings.manage');
    const input: CenterSettingsInput = parseForm(centerSettingsSchema, formData);

    const existing = await prisma.center.findUnique({ where: { id: actor.centerId } });
    if (!existing) throw new AppError('NOT_FOUND', 'Centre introuvable', undefined, ekey('centerNotFound'));

    // `code` is the identifier printed on the documents and quoted in the audit
    // trail, so it stays unique across centres. The error Prisma raises here is
    // turned into a DUPLICATE banner by `handleError`, which maps the field back
    // to the input that has to change.
    const entries = centerSettingEntries(input);
    const settingsBefore = await currentSettingValues(actor.centerId);

    await prisma.$transaction(async (tx) => {
      await tx.center.update({
        where: { id: actor.centerId },
        data: {
          code: input.code,
          nameFr: input.nameFr,
          nameAr: input.nameAr,
          legalName: input.legalName,
          address: input.address,
          city: input.city,
          phone: input.phone,
          whatsapp: input.whatsapp,
          email: input.email,
          facebook: input.facebook,
          instagram: input.instagram,
          website: input.website,
          logoPath: input.logoPath,
          primaryColor: input.primaryColor,
          secondaryColor: input.secondaryColor,
          timezone: input.timezone,
        },
      });

      for (const [key, value] of entries) {
        await tx.centerSetting.upsert({
          where: { centerId_key: { centerId: actor.centerId, key } },
          create: { centerId: actor.centerId, key, value },
          update: { value },
        });
      }
    });

    await recordChange({
      user: actor,
      action: 'SETTINGS_CHANGE',
      entity: 'Center',
      entityId: actor.centerId,
      metadata: {
        code: input.code,
        changes: diffFields(
          existing as unknown as Record<string, unknown>,
          {
            // `code` is written, so it belongs in the diff: a change of the
            // identifier printed on every document is exactly what an auditor
            // reads this entry for.
            code: input.code,
            nameFr: input.nameFr,
            nameAr: input.nameAr,
            legalName: input.legalName,
            address: input.address,
            city: input.city,
            phone: input.phone,
            whatsapp: input.whatsapp,
            email: input.email,
            facebook: input.facebook,
            instagram: input.instagram,
            website: input.website,
            logoPath: input.logoPath,
            primaryColor: input.primaryColor,
            secondaryColor: input.secondaryColor,
            timezone: input.timezone,
          },
        ),
        settingsChanges: diffFields(settingsBefore, Object.fromEntries(entries)),
      },
    });

    revalidateSettingsViews();
    return ok({ id: actor.centerId });
  } catch (error) {
    return handleError(error, 'updateCenterSettings');
  }
}