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
import { createSubjectAction, updateSubjectAction } from '@/actions/subjects';
import { subjectCreateSchema } from '@/lib/validation/people';
import type {
  AcademicsLabels,
  CategoryOptionView,
  FieldErrorMap,
  SubjectFormValues,
} from '@/components/catalog/types';

/**
 * Create / edit form for one subject - and, with `languageMode`, for one
 * language.
 *
 * A language is a subject flagged `isLanguage`, so there is one form and one
 * table, not two screens pretending to be different entities. In language mode
 * the checkbox is replaced by a fixed hidden `isLanguage=true`: the flag is
 * implied by the tab the user is on, but the *update* action still writes the
 * field, so an omitted value would silently turn a language back into a plain
 * subject.
 */

export type SubjectFormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: FieldErrorMap;
};

const INITIAL_STATE: SubjectFormState = { ok: false };

/** One value per key (last wins) and no empty entry for optional references. */
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

export function SubjectForm({
  recordId,
  values,
  languageMode,
  categoryOptions,
  labels,
  onCancel,
  onSaved,
}: {
  recordId: string | null;
  values: SubjectFormValues;
  /** True on the "languages" tab: the flag is implied and not editable. */
  languageMode: boolean;
  categoryOptions: CategoryOptionView[];
  labels: AcademicsLabels;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, formAction] = useActionState<SubjectFormState, FormData>(
    async (_previous, rawFormData) => {
      // `active` and `isLanguage` are booleans: their empty value is the way to
      // say "false", so they must survive the blank-stripping pass.
      const formData = catalogFormData(rawFormData, languageMode ? ['active', 'isLanguage'] : ['active']);

      const parsed = subjectCreateSchema.safeParse(Object.fromEntries(formData.entries()));
      if (!parsed.success) {
        return {
          ok: false,
          error: labels.error,
          fieldErrors: issuesToFieldErrors(parsed.error.issues),
        };
      }

      try {
        const result = recordId
          ? await updateSubjectAction(recordId, formData)
          : await createSubjectAction(formData, { forceLanguage: languageMode });

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
        <Field label={labels.code} htmlFor="subject-code" required error={fieldErrors.code?.[0]}>
          <Input
            id="subject-code"
            name="code"
            defaultValue={values.code}
            dir="ltr"
            required
            maxLength={20}
            placeholder={languageMode ? 'LAN-FR' : 'MAT-0001'}
            invalid={invalid('code')}
          />
        </Field>

        <Field
          label={`${labels.subjectCategory} (${labels.optional})`}
          htmlFor="subject-categoryId"
          error={fieldErrors.categoryId?.[0]}
        >
          <Select
            id="subject-categoryId"
            name="categoryId"
            defaultValue={values.categoryId}
            invalid={invalid('categoryId')}
          >
            {/* Empty means "no category": the schema turns "" into null. */}
            <option value="">—</option>
            {categoryOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={labels.subjectNameFr} htmlFor="subject-nameFr" required error={fieldErrors.nameFr?.[0]}>
          <Input
            id="subject-nameFr"
            name="nameFr"
            defaultValue={values.nameFr}
            dir="ltr"
            required
            maxLength={80}
            invalid={invalid('nameFr')}
          />
        </Field>

        <Field
          label={`${labels.subjectNameAr} (${labels.optional})`}
          htmlFor="subject-nameAr"
          error={fieldErrors.nameAr?.[0]}
        >
          <Input
            id="subject-nameAr"
            name="nameAr"
            defaultValue={values.nameAr}
            dir="rtl"
            maxLength={80}
            invalid={invalid('nameAr')}
          />
        </Field>

        {!languageMode ? (
          <Field label={labels.subjectIsLanguage} htmlFor="subject-isLanguage" error={fieldErrors.isLanguage?.[0]}>
            <input type="hidden" name="isLanguage" value="" />
            <input
              id="subject-isLanguage"
              name="isLanguage"
              type="checkbox"
              value="true"
              defaultChecked={values.isLanguage === 'true'}
              className="size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
          </Field>
        ) : (
          // Still posted on edit: `updateSubjectAction` writes the field, and a
          // missing value would fall back to the schema default of `false`.
          <input type="hidden" name="isLanguage" value="true" />
        )}

        <Field label={labels.subjectActive} htmlFor="subject-active" error={fieldErrors.active?.[0]}>
          <input type="hidden" name="active" value="" />
          <input
            id="subject-active"
            name="active"
            type="checkbox"
            value="true"
            defaultChecked={values.active !== 'false'}
            className="size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
          />
        </Field>
      </div>

      <Field
        label={`${labels.subjectDescription} (${labels.optional})`}
        htmlFor="subject-description"
        error={fieldErrors.description?.[0]}
      >
        <Textarea
          id="subject-description"
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