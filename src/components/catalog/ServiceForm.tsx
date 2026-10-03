'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Alert,
  Button,
  Field,
  Input,
  Spinner,
  Textarea,
} from '@/components/ui';
import { createServiceAction, updateServiceAction } from '@/actions/services';
import { serviceCreateSchema } from '@/lib/validation/people';
import { parseOptionalMoney } from '@/lib/validation/common';
import type { FieldErrorMap, ServiceFormValues, ServiceLabels } from '@/components/catalog/types';

/**
 * Create / edit form for one service.
 *
 * Money is the one field that cannot be copied straight into FormData. The user
 * types a decimal ("250", "250.5", "250,50") and `moneySchema` - the same
 * helper the rest of the application uses - turns it into integer centimes,
 * which is what the action persists. The conversion happens through the digits,
 * never by multiplying a float, and the client never posts a price it invented
 * with `.toFixed()` arithmetic or `toLocaleString()`.
 */

export type ServiceFormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: FieldErrorMap;
};

const INITIAL_STATE: ServiceFormState = { ok: false };

/** One value per key (last wins), empty booleans preserved. */
function catalogFormData(raw: FormData, keepBlank: readonly string[]): FormData {
  const clean = new FormData();
  for (const [key, value] of raw.entries()) {
    clean.delete(key);
    if (typeof value === 'string' && value === '' && !keepBlank.includes(key)) continue;
    clean.append(key, value);
  }
  return clean;
}

/** Same field map as `validationError()` in `@/lib/utils/errors`, built locally. */
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

export function ServiceForm({
  recordId,
  values,
  labels,
  onCancel,
  onSaved,
}: {
  recordId: string | null;
  values: ServiceFormValues;
  labels: ServiceLabels;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, formAction] = useActionState<ServiceFormState, FormData>(
    async (_previous, rawFormData) => {
      const formData = catalogFormData(rawFormData, ['active']);

      // The typed decimal is converted once, here, with the shared money
      // schema; what travels is `defaultPriceCents`, the column's own unit. A
      // blank price is 0, which is what the column and the schema already
      // default to, so an unpriced service can be created.
      const price = parseOptionalMoney(formData.get('price'));
      if (!price.ok) {
        // The money schema is a leaf, so its issues carry no path: they belong
        // to the price input the user was looking at.
        return {
          ok: false,
          error: labels.error,
          fieldErrors: { price: price.messages },
        };
      }
      formData.delete('price');
      formData.set('defaultPriceCents', String(price.cents));

      const parsed = serviceCreateSchema.safeParse(Object.fromEntries(formData.entries()));
      if (!parsed.success) {
        return {
          ok: false,
          error: labels.error,
          fieldErrors: issuesToFieldErrors(parsed.error.issues),
        };
      }

      try {
        const result = recordId
          ? await updateServiceAction(recordId, formData)
          : await createServiceAction(formData);

        if (result.ok) {
          onSaved();
          return { ok: true };
        }
        return { ok: false, error: result.error, fieldErrors: result.fieldErrors };
      } catch {
        return { ok: false, error: labels.error };
      }
    },
    INITIAL_STATE,
  );

  const fieldErrors = state.fieldErrors ?? {};
  const invalid = (name: string) => Boolean(fieldErrors[name]);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={labels.code} htmlFor="service-code" required error={fieldErrors.code?.[0]}>
          <Input
            id="service-code"
            name="code"
            defaultValue={values.code}
            dir="ltr"
            required
            maxLength={20}
            placeholder="SRV-0001"
            invalid={invalid('code')}
          />
        </Field>

        <Field
          label={`${labels.price} (${labels.optional})`}
          htmlFor="service-price"
          error={fieldErrors.price?.[0]}
        >
          <Input
            id="service-price"
            name="price"
            type="text"
            inputMode="decimal"
            defaultValue={values.price}
            dir="ltr"
            placeholder="250.00"
            autoComplete="off"
            invalid={invalid('price')}
          />
        </Field>

        <Field label={labels.nameFr} htmlFor="service-nameFr" required error={fieldErrors.nameFr?.[0]}>
          <Input
            id="service-nameFr"
            name="nameFr"
            defaultValue={values.nameFr}
            dir="ltr"
            required
            maxLength={80}
            invalid={invalid('nameFr')}
          />
        </Field>

        <Field
          label={`${labels.nameAr} (${labels.optional})`}
          htmlFor="service-nameAr"
          error={fieldErrors.nameAr?.[0]}
        >
          <Input
            id="service-nameAr"
            name="nameAr"
            defaultValue={values.nameAr}
            dir="rtl"
            maxLength={80}
            invalid={invalid('nameAr')}
          />
        </Field>

        <Field
          label={`${labels.duration} (${labels.optional})`}
          htmlFor="service-duration"
          error={fieldErrors.defaultDurationMinutes?.[0]}
        >
          <Input
            id="service-duration"
            name="defaultDurationMinutes"
            type="number"
            min={0}
            max={100000}
            step={5}
            defaultValue={values.durationMinutes}
            dir="ltr"
            invalid={invalid('defaultDurationMinutes')}
          />
        </Field>

        <Field label={labels.serviceActive} htmlFor="service-active" error={fieldErrors.active?.[0]}>
          <input type="hidden" name="active" value="" />
          <input
            id="service-active"
            name="active"
            type="checkbox"
            value="true"
            defaultChecked={values.active !== 'false'}
            className="size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
          />
        </Field>
      </div>

      <Field
        label={`${labels.description} (${labels.optional})`}
        htmlFor="service-description"
        error={fieldErrors.description?.[0]}
      >
        <Textarea
          id="service-description"
          name="description"
          defaultValue={values.description}
          maxLength={500}
          invalid={invalid('description')}
        />
      </Field>

      <div className="flex justify-end gap-2 border-t border-ink-200 pt-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={state.ok}>
          {labels.cancel}
        </Button>
        <SubmitButton label={recordId ? labels.save : labels.create} pendingLabel={labels.loading} />
      </div>
    </form>
  );
}