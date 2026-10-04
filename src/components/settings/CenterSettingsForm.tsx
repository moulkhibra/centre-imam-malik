'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Field, Input, Select, Spinner, Textarea } from '@/components/ui';
import { updateCenterSettingsAction } from '@/actions/settings';
import { centerSettingsSchema } from '@/lib/validation/settings';
import type { ErrorMessage } from '@/lib/validation/messages';
import type { FieldErrorMap } from '@/components/admin/types';
import type { SettingsFormValues, SettingsSection, SettingsViewLabels } from '@/components/settings/types';

/**
 * The centre settings form.
 *
 * One form writes two tables (`Center` columns and `CenterSetting` rows) through
 * one action, so a rejected value never leaves half the screen saved.
 *
 * Two behaviours are deliberate:
 *
 *  - Uncontrolled inputs with `defaultValue`, not controlled ones. With more than
 *    twenty fields a controlled form means re-rendering the whole screen on every
 *    keystroke, and worse: the Server Component re-render after a save would
 *    overwrite a half-typed field. Nothing on this screen needs to react to a
 *    value except the logo preview and the colour swatches, which read their own
 *    input through a ref.
 *  - The colour inputs carry a native `type="color"` next to the hex field. The
 *    hex text is the stored value; the swatch is the picker. A colour that was
 *    never valid cannot be picked, and a value the operator pasted by hand stays
 *    visible as text instead of silently snapping to black.
 *
 * `readOnly` renders the same fields disabled rather than a different screen: a
 * reader without `settings.manage` sees what the centre is configured with, and
 * the fields carry no controls to press.
 */

export type SettingsFormState = {
  ok: boolean;
  error?: string;
  errorKey?: ErrorMessage;
  fieldErrors?: FieldErrorMap;
};

const INITIAL_STATE: SettingsFormState = { ok: false };

function issuesToFieldErrors(issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_form';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Spinner /> : null}
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function CenterSettingsForm({
  values,
  labels,
  sections,
  canManage,
}: {
  values: SettingsFormValues;
  labels: SettingsViewLabels;
  sections: { identity: SettingsSection; contact: SettingsSection; appearance: SettingsSection; documents: SettingsSection };
  canManage: boolean;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<SettingsFormState, FormData>(
    async (_previous, formData) => {
      const parsed = centerSettingsSchema.safeParse(Object.fromEntries(formData.entries()));
      if (!parsed.success) {
        return { ok: false, error: labels.error, fieldErrors: issuesToFieldErrors(parsed.error.issues) };
      }

      try {
        const result = await updateCenterSettingsAction(formData);
        if (result.ok) {
          // The colours and the centre name live in the root layout, so the save
          // has to re-render it and not only this route.
          router.refresh();
          return { ok: true };
        }
        return {
          ok: false,
          error: result.error,
          errorKey: result.errorKey,
          fieldErrors: result.fieldErrors,
        };
      } catch {
        return { ok: false, error: labels.error };
      }
    },
    INITIAL_STATE,
  );

  const fieldErrors = state.fieldErrors ?? {};
  const invalid = (name: string) => Boolean(fieldErrors[name]);
  // Not disabled after a save: the confirmation is a message, not a lock. A
  // second correction has to be possible without a page reload.
  const disabled = !canManage;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {!canManage ? (
        <Alert tone="info">{labels.readOnly}</Alert>
      ) : null}

      {state.error ? (
        <Alert tone="danger" errorKey={state.errorKey}>
          {state.error}
        </Alert>
      ) : null}

      {state.ok ? <Alert tone="success">{labels.saved}</Alert> : null}

      <Card>
        <SectionTitle section={sections.identity} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={labels.fields.code} htmlFor="center-code" required error={fieldErrors.code?.[0]}>
            <Input id="center-code" name="code" defaultValue={values.code} dir="ltr" required maxLength={20} disabled={disabled} invalid={invalid('code')} />
          </Field>
          <Field label={labels.fields.nameFr} htmlFor="center-nameFr" required error={fieldErrors.nameFr?.[0]}>
            <Input id="center-nameFr" name="nameFr" defaultValue={values.nameFr} dir="ltr" required maxLength={120} disabled={disabled} invalid={invalid('nameFr')} />
          </Field>
          <Field label={labels.fields.nameAr} htmlFor="center-nameAr" error={fieldErrors.nameAr?.[0]}>
            <Input id="center-nameAr" name="nameAr" defaultValue={values.nameAr} dir="rtl" lang="ar" maxLength={120} disabled={disabled} invalid={invalid('nameAr')} />
          </Field>
          <Field label={labels.fields.legalName} htmlFor="center-legalName" error={fieldErrors.legalName?.[0]}>
            <Input id="center-legalName" name="legalName" defaultValue={values.legalName} dir="ltr" maxLength={120} disabled={disabled} invalid={invalid('legalName')} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle section={sections.contact} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={labels.fields.address} htmlFor="center-address" error={fieldErrors.address?.[0]}>
            <Input id="center-address" name="address" defaultValue={values.address} dir="ltr" maxLength={200} disabled={disabled} invalid={invalid('address')} />
          </Field>
          <Field label={labels.fields.city} htmlFor="center-city" error={fieldErrors.city?.[0]}>
            <Input id="center-city" name="city" defaultValue={values.city} dir="ltr" maxLength={80} disabled={disabled} invalid={invalid('city')} />
          </Field>
          <Field label={labels.fields.phone} htmlFor="center-phone" error={fieldErrors.phone?.[0]}>
            <Input id="center-phone" name="phone" type="tel" defaultValue={values.phone} dir="ltr" maxLength={25} disabled={disabled} invalid={invalid('phone')} />
          </Field>
          <Field label={labels.fields.whatsapp} htmlFor="center-whatsapp" error={fieldErrors.whatsapp?.[0]}>
            <Input id="center-whatsapp" name="whatsapp" type="tel" defaultValue={values.whatsapp} dir="ltr" maxLength={25} disabled={disabled} invalid={invalid('whatsapp')} />
          </Field>
          <Field label={labels.fields.email} htmlFor="center-email" error={fieldErrors.email?.[0]}>
            <Input id="center-email" name="email" type="email" defaultValue={values.email} dir="ltr" maxLength={160} disabled={disabled} invalid={invalid('email')} />
          </Field>
          <Field label={labels.fields.facebook} htmlFor="center-facebook" error={fieldErrors.facebook?.[0]}>
            <Input id="center-facebook" name="facebook" defaultValue={values.facebook} dir="ltr" maxLength={160} disabled={disabled} invalid={invalid('facebook')} />
          </Field>
          <Field label={labels.fields.instagram} htmlFor="center-instagram" error={fieldErrors.instagram?.[0]}>
            <Input id="center-instagram" name="instagram" defaultValue={values.instagram} dir="ltr" maxLength={160} disabled={disabled} invalid={invalid('instagram')} />
          </Field>
          <Field label={labels.fields.website} htmlFor="center-website" error={fieldErrors.website?.[0]}>
            <Input id="center-website" name="website" defaultValue={values.website} dir="ltr" maxLength={160} disabled={disabled} invalid={invalid('website')} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle section={sections.appearance} />
        <div className="grid gap-3 sm:grid-cols-2">
          <ColorField
            id="center-primaryColor"
            name="primaryColor"
            label={labels.fields.primaryColor}
            value={values.primaryColor}
            disabled={disabled}
            error={fieldErrors.primaryColor?.[0]}
          />
          <ColorField
            id="center-secondaryColor"
            name="secondaryColor"
            label={labels.fields.secondaryColor}
            value={values.secondaryColor}
            disabled={disabled}
            error={fieldErrors.secondaryColor?.[0]}
          />
          <Field label={labels.fields.timezone} htmlFor="center-timezone" required error={fieldErrors.timezone?.[0]}>
            <Input id="center-timezone" name="timezone" defaultValue={values.timezone} dir="ltr" required maxLength={60} disabled={disabled} invalid={invalid('timezone')} />
          </Field>
          <Field label={labels.fields.locale} htmlFor="center-locale" required error={fieldErrors.locale?.[0]}>
            <Select id="center-locale" name="locale" defaultValue={values.locale} disabled={disabled} invalid={invalid('locale')}>
              {Object.entries(labels.localeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <LogoField
            id="center-logoPath"
            name="logoPath"
            label={labels.fields.logoPath}
            hint={labels.fields.logoPathHint}
            altLabel={labels.logoPreviewAlt}
            value={values.logoPath}
            disabled={disabled}
            error={fieldErrors.logoPath?.[0]}
          />
        </div>
      </Card>

      <Card>
        <SectionTitle section={sections.documents} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={labels.fields.receiptFooterFr} htmlFor="center-receiptFooterFr" error={fieldErrors.receiptFooterFr?.[0]}>
            <Textarea id="center-receiptFooterFr" name="receiptFooterFr" defaultValue={values.receiptFooterFr} dir="ltr" rows={3} maxLength={500} disabled={disabled} invalid={invalid('receiptFooterFr')} />
          </Field>
          <Field label={labels.fields.receiptFooterAr} htmlFor="center-receiptFooterAr" error={fieldErrors.receiptFooterAr?.[0]}>
            <Textarea id="center-receiptFooterAr" name="receiptFooterAr" defaultValue={values.receiptFooterAr} dir="rtl" lang="ar" rows={3} maxLength={500} disabled={disabled} invalid={invalid('receiptFooterAr')} />
          </Field>
          <Field label={labels.fields.certificateFooterFr} htmlFor="center-certificateFooterFr" error={fieldErrors.certificateFooterFr?.[0]}>
            <Textarea id="center-certificateFooterFr" name="certificateFooterFr" defaultValue={values.certificateFooterFr} dir="ltr" rows={3} maxLength={500} disabled={disabled} invalid={invalid('certificateFooterFr')} />
          </Field>
          <Field label={labels.fields.certificateFooterAr} htmlFor="center-certificateFooterAr" error={fieldErrors.certificateFooterAr?.[0]}>
            <Textarea id="center-certificateFooterAr" name="certificateFooterAr" defaultValue={values.certificateFooterAr} dir="rtl" lang="ar" rows={3} maxLength={500} disabled={disabled} invalid={invalid('certificateFooterAr')} />
          </Field>
          <Field label={labels.fields.directorNameFr} htmlFor="center-directorNameFr" error={fieldErrors.directorNameFr?.[0]}>
            <Input id="center-directorNameFr" name="directorNameFr" defaultValue={values.directorNameFr} dir="ltr" maxLength={120} disabled={disabled} invalid={invalid('directorNameFr')} />
          </Field>
          <Field label={labels.fields.directorNameAr} htmlFor="center-directorNameAr" error={fieldErrors.directorNameAr?.[0]}>
            <Input id="center-directorNameAr" name="directorNameAr" defaultValue={values.directorNameAr} dir="rtl" lang="ar" maxLength={120} disabled={disabled} invalid={invalid('directorNameAr')} />
          </Field>
        </div>
      </Card>

      {canManage ? (
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-ink-200 bg-white/90 py-3 backdrop-blur">
          <SubmitButton label={labels.save} pendingLabel={labels.loading} />
        </div>
      ) : null}
    </form>
  );
}

function SectionTitle({ section }: { section: SettingsSection }) {
  return (
    <div className="mb-3 border-b border-ink-200 pb-2">
      <h2 className="text-sm font-semibold text-ink-900">{section.title}</h2>
      {section.hint ? <p className="mt-0.5 text-xs text-ink-500">{section.hint}</p> : null}
    </div>
  );
}

/**
 * A colour as a hex field plus a native picker.
 *
 * Only this pair is controlled - the rest of the screen is not - and it is
 * controlled because the picker has to write into the text field. The submitted
 * value is always the text field's, so the hex the server stores is the one the
 * operator can see. The swatch falls back to the stored value while the text is
 * half-typed, because `<input type="color">` cannot hold a partial hex and would
 * otherwise repaint itself to black on the first keystroke.
 */
function ColorField({
  id,
  name,
  label,
  value,
  disabled,
  error,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  disabled: boolean;
  error?: string;
}) {
  const [hex, setHex] = useState(value);
  const swatch = /^#[0-9a-f]{6}$/i.test(hex) ? hex : value;

  return (
    <Field label={label} htmlFor={id} required error={error}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={swatch}
          disabled={disabled}
          onChange={(event) => setHex(event.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded border border-ink-200 bg-white p-0.5 disabled:cursor-not-allowed"
        />
        <Input
          id={id}
          name={name}
          value={hex}
          onChange={(event) => setHex(event.target.value)}
          dir="ltr"
          required
          maxLength={7}
          placeholder="#1d4ed8"
          disabled={disabled}
          invalid={Boolean(error)}
        />
      </div>
    </Field>
  );
}

/**
 * The logo path, with the file it names shown next to it.
 *
 * There is no upload in this application, so this is a path field plus a preview:
 * the administrator drops the file into `public/` and types where. A broken path
 * shows the alt text instead of a silent empty box, which is the one piece of
 * feedback available without an upload route.
 */
function LogoField({
  id,
  name,
  label,
  hint,
  altLabel,
  value,
  disabled,
  error,
}: {
  id: string;
  name: string;
  label: string;
  hint: string;
  altLabel: string;
  value: string;
  disabled: boolean;
  error?: string;
}) {
  const [preview, setPreview] = useState(value);

  return (
    <Field label={label} htmlFor={id} hint={hint} error={error}>
      <div className="flex items-center gap-3">
        <Input
          id={id}
          name={name}
          defaultValue={value}
          dir="ltr"
          maxLength={200}
          placeholder="/logo.png"
          disabled={disabled}
          invalid={Boolean(error)}
          onChange={(event) => setPreview(event.target.value)}
        />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={altLabel} className="h-10 w-10 shrink-0 rounded border border-ink-200 bg-white object-contain" />
        ) : null}
      </div>
    </Field>
  );
}