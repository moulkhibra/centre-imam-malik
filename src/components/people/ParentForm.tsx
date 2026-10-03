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
import { createParentAction, updateParentAction } from '@/actions/parents';
import { parentCreateSchema } from '@/lib/validation/people';
import type { ErrorMessage } from '@/lib/validation/messages';
import type { ParentFormValues, PeopleLabels } from '@/components/people/types';

/**
 * Create / edit form for one parent.
 *
 * Same contract as `StudentForm`: the submitted payload is validated here with
 * the very schema the Server Action parses, and the identical `FormData` is
 * what gets sent, so the two views can never disagree about what was typed.
 */

export type ParentFormState = {
  ok: boolean;
  error?: string;
  errorKey?: ErrorMessage;
  fieldErrors?: Record<string, string[] | undefined>;
  savedId?: string;
};

const INITIAL_STATE: ParentFormState = { ok: false };

/** See `StudentForm`: a blank value must mean "absent", not `""`. */
function withoutBlanks(formData: FormData): FormData {
  const clean = new FormData();
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string' && value.trim() === '') continue;
    clean.append(key, value);
  }
  return clean;
}

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

export function ParentForm({
  recordId,
  values,
  labels,
  onCancel,
  onSaved,
}: {
  recordId: string | null;
  values: ParentFormValues;
  labels: PeopleLabels;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, formAction] = useActionState<ParentFormState, FormData>(
    async (_previous, rawFormData) => {
      const formData = withoutBlanks(rawFormData);

      const parsed = parentCreateSchema.safeParse(Object.fromEntries(formData.entries()));
      if (!parsed.success) {
        return {
          ok: false,
          error: labels.error,
          fieldErrors: issuesToFieldErrors(parsed.error.issues),
        };
      }

      try {
        const result = recordId
          ? await updateParentAction(recordId, formData)
          : await createParentAction(formData);

        if (result.ok) {
          onSaved();
          return { ok: true, savedId: result.data.id };
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

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? (
        <Alert tone="danger" errorKey={state.errorKey}>
          {state.error}
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={`${labels.code} (${labels.optional})`}
          htmlFor="parent-code"
          error={fieldErrors.code?.[0]}
        >
          <Input
            id="parent-code"
            name="code"
            defaultValue={values.code}
            dir="ltr"
            maxLength={20}
            placeholder="PAR-0001"
            invalid={invalid('code')}
          />
        </Field>

        <Field
          label={labels.relation}
          htmlFor="parent-relation"
          error={fieldErrors.relation?.[0]}
        >
          <Input
            id="parent-relation"
            name="relation"
            defaultValue={values.relation}
            maxLength={60}
            invalid={invalid('relation')}
          />
        </Field>

        <Field
          label={labels.lastName}
          htmlFor="parent-lastName"
          required
          error={fieldErrors.lastName?.[0]}
        >
          <Input
            id="parent-lastName"
            name="lastName"
            defaultValue={values.lastName}
            dir="ltr"
            required
            maxLength={80}
            invalid={invalid('lastName')}
          />
        </Field>

        <Field
          label={labels.firstName}
          htmlFor="parent-firstName"
          required
          error={fieldErrors.firstName?.[0]}
        >
          <Input
            id="parent-firstName"
            name="firstName"
            defaultValue={values.firstName}
            dir="ltr"
            required
            maxLength={80}
            invalid={invalid('firstName')}
          />
        </Field>

        <Field label={labels.cin} htmlFor="parent-cin" error={fieldErrors.cin?.[0]}>
          <Input
            id="parent-cin"
            name="cin"
            defaultValue={values.cin}
            dir="ltr"
            maxLength={10}
            placeholder="AB123456"
            invalid={invalid('cin')}
          />
        </Field>

        <Field label={labels.phone} htmlFor="parent-phone" error={fieldErrors.phone?.[0]}>
          <Input
            id="parent-phone"
            name="phone"
            type="tel"
            defaultValue={values.phone}
            dir="ltr"
            maxLength={25}
            invalid={invalid('phone')}
          />
        </Field>

        <Field label={labels.whatsapp} htmlFor="parent-whatsapp" error={fieldErrors.whatsapp?.[0]}>
          <Input
            id="parent-whatsapp"
            name="whatsapp"
            type="tel"
            defaultValue={values.whatsapp}
            dir="ltr"
            maxLength={25}
            invalid={invalid('whatsapp')}
          />
        </Field>

        <Field label={labels.email} htmlFor="parent-email" error={fieldErrors.email?.[0]}>
          <Input
            id="parent-email"
            name="email"
            type="email"
            defaultValue={values.email}
            dir="ltr"
            maxLength={160}
            invalid={invalid('email')}
          />
        </Field>

        <Field label={labels.city} htmlFor="parent-city" error={fieldErrors.city?.[0]}>
          <Input
            id="parent-city"
            name="city"
            defaultValue={values.city}
            maxLength={80}
            invalid={invalid('city')}
          />
        </Field>
      </div>

      <Field label={labels.address} htmlFor="parent-address" error={fieldErrors.address?.[0]}>
        <Input
          id="parent-address"
          name="address"
          defaultValue={values.address}
          maxLength={200}
          invalid={invalid('address')}
        />
      </Field>

      <Field label={labels.notes} htmlFor="parent-notes" error={fieldErrors.notes?.[0]}>
        <Textarea
          id="parent-notes"
          name="notes"
          defaultValue={values.notes}
          maxLength={1000}
          invalid={invalid('notes')}
        />
      </Field>

      <div className="flex justify-end gap-2 border-t border-ink-200 pt-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {labels.cancel}
        </Button>
        <SubmitButton
          label={recordId ? labels.save : labels.create}
          pendingLabel={labels.loading}
        />
      </div>
    </form>
  );
}
