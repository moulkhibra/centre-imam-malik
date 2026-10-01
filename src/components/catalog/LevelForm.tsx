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
} from '@/components/ui';
import { createLevelAction, updateLevelAction } from '@/actions/levels';
import { levelCreateSchema } from '@/lib/validation/people';
import type {
  AcademicsLabels,
  FieldErrorMap,
  LevelFormValues,
  ValueLabels,
} from '@/components/catalog/types';

/**
 * Create / edit form for one academic level.
 *
 * Same contract as `TeacherForm`: the parent passes a `key` derived from the
 * record, validation runs twice with the *same* Zod schema (here, once for a
 * round-trip-free error and once inside the Server Action, the copy that
 * protects the database), and every field the update action writes is present
 * even when it has no column in the table.
 *
 * An omitted input posts nothing and the schema would then apply its default -
 * which for `active` is `true`. So the checkbox is paired with a hidden
 * `value=""` placed *before* it: unchecked submits `""` (read as `false` by
 * `z.coerce.boolean()`), checked submits `"true"`.
 */

export type LevelFormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: FieldErrorMap;
};

const INITIAL_STATE: LevelFormState = { ok: false };

/**
 * Collapses a submitted form into what the server schema expects: one value per
 * key (the last one wins, which is what the hidden-input/checkbox pair relies
 * on) and no empty entry for a field whose `.optional()` should kick in.
 *
 * `keepBlank` lists the boolean fields, whose empty value is meaningful.
 */
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

export function LevelForm({
  recordId,
  values,
  stageLabels,
  labels,
  onCancel,
  onSaved,
}: {
  recordId: string | null;
  values: LevelFormValues;
  stageLabels: ValueLabels;
  labels: AcademicsLabels;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, formAction] = useActionState<LevelFormState, FormData>(
    async (_previous, rawFormData) => {
      const formData = catalogFormData(rawFormData, ['active']);

      const parsed = levelCreateSchema.safeParse(Object.fromEntries(formData.entries()));
      if (!parsed.success) {
        return {
          ok: false,
          error: labels.error,
          fieldErrors: issuesToFieldErrors(parsed.error.issues),
        };
      }

      try {
        const result = recordId
          ? await updateLevelAction(recordId, formData)
          : await createLevelAction(formData);

        if (result.ok) {
          onSaved();
          return { ok: true };
        }
        return { ok: false, error: result.error, fieldErrors: result.fieldErrors };
      } catch {
        // The actions catch their own errors, so reaching this branch means the
        // transport itself failed: report it instead of tearing down the page.
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
        <Field label={labels.code} htmlFor="level-code" required error={fieldErrors.code?.[0]}>
          <Input
            id="level-code"
            name="code"
            defaultValue={values.code}
            dir="ltr"
            required
            maxLength={20}
            placeholder="NIV-0001"
            invalid={invalid('code')}
          />
        </Field>

        <Field label={labels.levelStage} htmlFor="level-stage" required error={fieldErrors.stage?.[0]}>
          <Select id="level-stage" name="stage" defaultValue={values.stage} invalid={invalid('stage')}>
            {Object.keys(stageLabels).map((value) => (
              <option key={value} value={value}>
                {stageLabels[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={labels.levelNameFr} htmlFor="level-nameFr" required error={fieldErrors.nameFr?.[0]}>
          <Input
            id="level-nameFr"
            name="nameFr"
            defaultValue={values.nameFr}
            dir="ltr"
            required
            maxLength={80}
            invalid={invalid('nameFr')}
          />
        </Field>

        <Field
          label={`${labels.levelNameAr} (${labels.optional})`}
          htmlFor="level-nameAr"
          error={fieldErrors.nameAr?.[0]}
        >
          <Input
            id="level-nameAr"
            name="nameAr"
            defaultValue={values.nameAr}
            dir="rtl"
            maxLength={80}
            invalid={invalid('nameAr')}
          />
        </Field>

        <Field label={labels.levelSortOrder} htmlFor="level-sortOrder" error={fieldErrors.sortOrder?.[0]}>
          <Input
            id="level-sortOrder"
            name="sortOrder"
            type="number"
            min={0}
            max={100000}
            step={1}
            defaultValue={values.sortOrder}
            dir="ltr"
            invalid={invalid('sortOrder')}
          />
        </Field>

        <Field label={labels.levelActive} htmlFor="level-active" error={fieldErrors.active?.[0]}>
          {/* Paired with the hidden empty value: unchecked posts "" (false). */}
          <input type="hidden" name="active" value="" />
          <input
            id="level-active"
            name="active"
            type="checkbox"
            value="true"
            defaultChecked={values.active !== 'false'}
            className="size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
          />
        </Field>
      </div>

      <div className="flex justify-end gap-2 border-t border-ink-200 pt-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={state.ok}>
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