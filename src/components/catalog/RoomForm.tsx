'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Alert,
  Button,
  Field,
  Input,
  Select,
  Spinner,
  Textarea,
} from '@/components/ui';
import { createRoomAction, updateRoomAction } from '@/actions/rooms';
import { roomCreateSchema } from '@/lib/validation/people';
import type { ErrorMessage } from '@/lib/validation/messages';
import type { FieldErrorMap, RoomFormValues, RoomLabels, ValueLabels } from '@/components/catalog/types';

/**
 * Create / edit form for one room.
 *
 * Two independent switches live here and are deliberately not merged:
 * `status` is the availability the scheduler reads (AVAILABLE / MAINTENANCE /
 * CLOSED) while `active` says whether the room still belongs to the catalogue
 * at all. A room under maintenance is still an active room.
 */

export type RoomFormState = {
  ok: boolean;
  error?: string;
  errorKey?: ErrorMessage;
  fieldErrors?: FieldErrorMap;
};

const INITIAL_STATE: RoomFormState = { ok: false };

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

export function RoomForm({
  recordId,
  values,
  statusLabels,
  labels,
  onCancel,
  onSaved,
}: {
  recordId: string | null;
  values: RoomFormValues;
  statusLabels: ValueLabels;
  labels: RoomLabels;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, formAction] = useActionState<RoomFormState, FormData>(
    async (_previous, rawFormData) => {
      const formData = catalogFormData(rawFormData, ['active']);

      const parsed = roomCreateSchema.safeParse(Object.fromEntries(formData.entries()));
      if (!parsed.success) {
        return {
          ok: false,
          error: labels.error,
          fieldErrors: issuesToFieldErrors(parsed.error.issues),
        };
      }

      try {
        const result = recordId
          ? await updateRoomAction(recordId, formData)
          : await createRoomAction(formData);

        if (result.ok) {
          onSaved();
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

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? (
        <Alert tone="danger" errorKey={state.errorKey}>
          {state.error}
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={labels.name} htmlFor="room-name" required error={fieldErrors.name?.[0]}>
          <Input
            id="room-name"
            name="name"
            defaultValue={values.name}
            dir="ltr"
            required
            maxLength={80}
            invalid={invalid('name')}
          />
        </Field>

        <Field label={labels.capacity} htmlFor="room-capacity" error={fieldErrors.capacity?.[0]}>
          <Input
            id="room-capacity"
            name="capacity"
            type="number"
            min={0}
            max={100000}
            step={1}
            defaultValue={values.capacity}
            dir="ltr"
            invalid={invalid('capacity')}
          />
        </Field>

        <Field label={labels.status} htmlFor="room-status" required error={fieldErrors.status?.[0]}>
          <Select id="room-status" name="status" defaultValue={values.status} invalid={invalid('status')}>
            {Object.keys(statusLabels).map((value) => (
              <option key={value} value={value}>
                {statusLabels[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={`${labels.location} (${labels.optional})`}
          htmlFor="room-location"
          error={fieldErrors.location?.[0]}
        >
          <Input
            id="room-location"
            name="location"
            defaultValue={values.location}
            dir="ltr"
            maxLength={120}
            invalid={invalid('location')}
          />
        </Field>

        <Field label={labels.roomActive} htmlFor="room-active" error={fieldErrors.active?.[0]}>
          <input type="hidden" name="active" value="" />
          <input
            id="room-active"
            name="active"
            type="checkbox"
            value="true"
            defaultChecked={values.active !== 'false'}
            className="size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
          />
        </Field>
      </div>

      <Field
        label={`${labels.equipment} (${labels.optional})`}
        htmlFor="room-equipment"
        error={fieldErrors.equipment?.[0]}
      >
        <Input
          id="room-equipment"
          name="equipment"
          defaultValue={values.equipment}
          dir="ltr"
          maxLength={300}
          invalid={invalid('equipment')}
        />
      </Field>

      <Field label={`${labels.notes} (${labels.optional})`} htmlFor="room-notes" error={fieldErrors.notes?.[0]}>
        <Textarea
          id="room-notes"
          name="notes"
          defaultValue={values.notes}
          maxLength={500}
          invalid={invalid('notes')}
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