'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { requirePermission } from '@/lib/auth/permissions';
import { recordChange, diffFields } from '@/lib/audit';
import { AppError, handleError, ok, type ActionResult } from '@/lib/utils/errors';
import { ekey } from '@/lib/validation/messages';
import { parseForm } from '@/lib/action-utils';
import {
  CENTER_SETTING_KEYS,
  centerSettingEntries,
  centerSettingsSchema,
  type CenterSettingsInput,
} from '@/lib/validation/settings';
import { DEFAULT_CENTER_SETTINGS } from '@/lib/settings/defaults';
import { detectImageFormat } from '@/lib/storage/image-signature';
import { deleteUploadedLogo, saveUploadedLogo } from '@/lib/storage/uploads';
import { MAX_LOGO_BYTES } from '@/lib/constants';

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

/**
 * Stores a new centre logo, replacing the previous one.
 *
 * Deliberately its own action, and its own form: the settings form is a
 * `multipart` request only for this field, and a file input inside it would make
 * every other save carry the image too.
 *
 * The order matters. The bytes are checked before anything is written, the file
 * is written before the setting, and the previous file is deleted after the
 * transaction - so a refused upload leaves neither a file nor a setting, and a
 * crash between the two leaves one orphaned file instead of a broken logo.
 */
export async function uploadCenterLogoAction(formData: FormData): Promise<ActionResult<{ file: string }>> {
  try {
    const actor = await requirePermission('settings.manage');

    const entry = formData.get('logo');
    if (!(entry instanceof File) || entry.size === 0) {
      throw new AppError('VALIDATION', 'Aucun fichier reçu', undefined, ekey('logoMissing'));
    }
    if (entry.size > MAX_LOGO_BYTES) {
      throw new AppError('VALIDATION', 'Logo trop volumineux', undefined, ekey('logoTooLarge'));
    }

    // The bytes decide, never the name or the declared content type.
    const bytes = new Uint8Array(await entry.arrayBuffer());
    const format = detectImageFormat(bytes);
    if (!format) {
      throw new AppError('VALIDATION', 'Le fichier n\'est pas une image acceptée', undefined, ekey('logoNotAnImage'));
    }

    const previous = await currentLogoFile(actor.centerId);
    const storedName = await saveUploadedLogo(bytes, format);

    await prisma.$transaction(async (tx) => {
      await tx.centerSetting.upsert({
        where: { centerId_key: { centerId: actor.centerId, key: CENTER_SETTING_KEYS.logoFile } },
        create: { centerId: actor.centerId, key: CENTER_SETTING_KEYS.logoFile, value: storedName },
        update: { value: storedName },
      });
    });

    await recordChange({
      user: actor,
      action: 'SETTINGS_CHANGE',
      entity: 'Center',
      entityId: actor.centerId,
      // The file names, not the image: the audit says which file was replaced so
      // an auditor can find it in the uploads folder. The bytes are never logged.
      metadata: { logoFile: storedName, previousLogoFile: previous || null, format },
    });

    if (previous && previous !== storedName) await deleteUploadedLogo(previous);

    revalidateSettingsViews();
    return ok({ file: storedName });
  } catch (error) {
    return handleError(error, 'uploadCenterLogo');
  }
}

/**
 * Removes the uploaded logo and clears the setting.
 *
 * The `Center.logoPath` column is left alone: it belongs to the manual path
 * field, which the administrator may still be using.
 */
export async function removeCenterLogoAction(): Promise<ActionResult> {
  try {
    const actor = await requirePermission('settings.manage');

    const previous = await currentLogoFile(actor.centerId);
    if (!previous) return ok(undefined);

    await prisma.centerSetting.upsert({
      where: { centerId_key: { centerId: actor.centerId, key: CENTER_SETTING_KEYS.logoFile } },
      create: { centerId: actor.centerId, key: CENTER_SETTING_KEYS.logoFile, value: '' },
      update: { value: '' },
    });

    await recordChange({
      user: actor,
      action: 'SETTINGS_CHANGE',
      entity: 'Center',
      entityId: actor.centerId,
      metadata: { logoFile: null, previousLogoFile: previous },
    });

    await deleteUploadedLogo(previous);

    revalidateSettingsViews();
    return ok(undefined);
  } catch (error) {
    return handleError(error, 'removeCenterLogo');
  }
}

/** The stored name of the centre's uploaded logo, or '' when there is none. */
async function currentLogoFile(centerId: string): Promise<string> {
  const row = await prisma.centerSetting.findUnique({
    where: { centerId_key: { centerId, key: CENTER_SETTING_KEYS.logoFile } },
    select: { value: true },
  });
  return row?.value ?? '';
}
