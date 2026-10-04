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
import { createTeacherAction, updateTeacherAction } from '@/actions/teachers';
import { teacherCreateSchema } from '@/lib/validation/people';
import type { ErrorMessage } from '@/lib/validation/messages';
import type { FieldErrorMap, PeopleLabels, ValueLabels } from '@/components/people/types';

/**
 * Create / edit form for one teacher.
 *
 * The parent passes a `key` derived from the record, so switching from one
 * teacher to another remounts the form and its action state instead of leaving
 * the previous record's errors on screen.
 *
 * Validation runs twice with the *same* Zod schema: once here, so the user sees
 * the problem without a round-trip, and once inside the Server Action, which is
 * the copy that actually protects the database. The payload sent to the server
 * is the very FormData that was validated here, so the two copies can never
 * disagree.
 *
 * Every field the update action writes is present, including the ones that have
 * no column in the table: an omitted input posts nothing, the schema turns that
 * into `null`, and the record would silently lose the value.
 */

export type TeacherFormState = {
  ok: boolean;
  error?: string;
  errorKey?: ErrorMessage;
  fieldErrors?: FieldErrorMap;
  savedId?: string;
};

const INITIAL_STATE: TeacherFormState = { ok: false };

/**
 * Labels the teacher screen needs.
 *
 * `PeopleLabels` is the shared bag of strings every people screen uses; the
 * teacher-specific keys are added on top rather than re-declared in a second
 * parallel type.
 */
export type TeacherLabels = Pick<
  PeopleLabels,
  | 'title'
  | 'search'
  | 'searchPlaceholder'
  | 'searchAction'
  | 'reset'
  | 'noResults'
  | 'empty'
  | 'emptySearch'
  | 'subtitle'
  | 'code'
  | 'firstName'
  | 'lastName'
  | 'firstNameAr'
  | 'lastNameAr'
  | 'cin'
  | 'phone'
  | 'whatsapp'
  | 'email'
  | 'status'
  | 'actions'
  | 'new'
  | 'edit'
  | 'delete'
  | 'create'
  | 'save'
  | 'cancel'
  | 'confirm'
  | 'optional'
  | 'notes'
  | 'deleteConfirm'
  | 'deleteConfirmHint'
  | 'created'
  | 'updated'
  | 'deleted'
  | 'error'
  | 'loading'
  | 'previous'
  | 'next'
  | 'page'
  | 'of'
  | 'showing'
> & {
  specialization: string;
  bio: string;
  hiredAt: string;
  linkedGroups: string;
  linkedSubjects: string;
};

/** Every field the Zod schema knows about, flattened to strings for the inputs. */
export type TeacherFormValues = {
  code: string;
  firstName: string;
  lastName: string;
  firstNameAr: string;
  lastNameAr: string;
  phone: string;
  whatsapp: string;
  email: string;
  cin: string;
  specialization: string;
  bio: string;
  /** `YYYY-MM-DD` for `<input type="date">`, empty when unknown. */
  hiredAt: string;
  status: string;
  notes: string;
};

/**
 * Drops blank values from a submission.
 *
 * An `<input>`/`<select>` that the user left empty still submits `""`, and a
 * closed set such as `z.enum(STUDENT_STATUSES)` rejects that even though "not
 * chosen" is exactly what its `.optional()` describes. Removing the empty
 * entries makes an untouched field absent, which is what the schema expects,
 * while a deliberately rejected request that posts `status=` is still refused
 * by the server.
 */
function withoutBlanks(formData: FormData): FormData {
  const clean = new FormData();
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string' && value.trim() === '') continue;
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

export function TeacherForm({
  recordId,
  values,
  statusLabels,
  labels,
  onCancel,
  onSaved,
}: {
  recordId: string | null;
  values: TeacherFormValues;
  statusLabels: ValueLabels;
  labels: TeacherLabels;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, formAction] = useActionState<TeacherFormState, FormData>(
    async (_previous, rawFormData) => {
      const formData = withoutBlanks(rawFormData);

      const parsed = teacherCreateSchema.safeParse(Object.fromEntries(formData.entries()));
      if (!parsed.success) {
        return {
          ok: false,
          error: labels.error,
          fieldErrors: issuesToFieldErrors(parsed.error.issues),
        };
      }

      try {
        const result = recordId
          ? await updateTeacherAction(recordId, formData)
          : await createTeacherAction(formData);

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
      {state.error ? (
        <Alert tone="danger" errorKey={state.errorKey}>
          {state.error}
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={`${labels.code} (${labels.optional})`}
          htmlFor="teacher-code"
          error={fieldErrors.code?.[0]}
        >
          <Input
            id="teacher-code"
            name="code"
            defaultValue={values.code}
            dir="ltr"
            maxLength={20}
            placeholder="ENS-0001"
            invalid={invalid('code')}
          />
        </Field>

        <Field
          label={labels.status}
          htmlFor="teacher-status"
          error={fieldErrors.status?.[0]}
        >
          <Select id="teacher-status" name="status" defaultValue={values.status} invalid={invalid('status')}>
            {Object.keys(statusLabels).map((value) => (
              <option key={value} value={value}>
                {statusLabels[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={labels.lastName}
          htmlFor="teacher-lastName"
          required
          error={fieldErrors.lastName?.[0]}
        >
          <Input
            id="teacher-lastName"
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
          htmlFor="teacher-firstName"
          required
          error={fieldErrors.firstName?.[0]}
        >
          <Input
            id="teacher-firstName"
            name="firstName"
            defaultValue={values.firstName}
            dir="ltr"
            required
            maxLength={80}
            invalid={invalid('firstName')}
          />
        </Field>

        <Field
          label={labels.lastNameAr}
          htmlFor="teacher-lastNameAr"
          error={fieldErrors.lastNameAr?.[0]}
        >
          <Input
            id="teacher-lastNameAr"
            name="lastNameAr"
            defaultValue={values.lastNameAr}
            dir="rtl"
            maxLength={80}
            invalid={invalid('lastNameAr')}
          />
        </Field>

        <Field
          label={labels.firstNameAr}
          htmlFor="teacher-firstNameAr"
          error={fieldErrors.firstNameAr?.[0]}
        >
          <Input
            id="teacher-firstNameAr"
            name="firstNameAr"
            defaultValue={values.firstNameAr}
            dir="rtl"
            maxLength={80}
            invalid={invalid('firstNameAr')}
          />
        </Field>

        <Field
          label={labels.hiredAt}
          htmlFor="teacher-hiredAt"
          error={fieldErrors.hiredAt?.[0]}
        >
          <Input
            id="teacher-hiredAt"
            name="hiredAt"
            type="date"
            defaultValue={values.hiredAt}
            dir="ltr"
            invalid={invalid('hiredAt')}
          />
        </Field>

        <Field label={labels.cin} htmlFor="teacher-cin" error={fieldErrors.cin?.[0]}>
          <Input
            id="teacher-cin"
            name="cin"
            defaultValue={values.cin}
            dir="ltr"
            maxLength={10}
            placeholder="AB123456"
            invalid={invalid('cin')}
          />
        </Field>

        <Field label={labels.phone} htmlFor="teacher-phone" error={fieldErrors.phone?.[0]}>
          <Input
            id="teacher-phone"
            name="phone"
            type="tel"
            defaultValue={values.phone}
            dir="ltr"
            maxLength={25}
            invalid={invalid('phone')}
          />
        </Field>

        <Field label={labels.whatsapp} htmlFor="teacher-whatsapp" error={fieldErrors.whatsapp?.[0]}>
          <Input
            id="teacher-whatsapp"
            name="whatsapp"
            type="tel"
            defaultValue={values.whatsapp}
            dir="ltr"
            maxLength={25}
            invalid={invalid('whatsapp')}
          />
        </Field>

        <Field label={labels.email} htmlFor="teacher-email" error={fieldErrors.email?.[0]}>
          <Input
            id="teacher-email"
            name="email"
            type="email"
            defaultValue={values.email}
            dir="ltr"
            maxLength={160}
            invalid={invalid('email')}
          />
        </Field>
      </div>

      <Field
        label={labels.specialization}
        htmlFor="teacher-specialization"
        error={fieldErrors.specialization?.[0]}
      >
        <Input
          id="teacher-specialization"
          name="specialization"
          defaultValue={values.specialization}
          maxLength={120}
          invalid={invalid('specialization')}
        />
      </Field>

      <Field label={labels.bio} htmlFor="teacher-bio" error={fieldErrors.bio?.[0]}>
        <Textarea
          id="teacher-bio"
          name="bio"
          defaultValue={values.bio}
          maxLength={1000}
          invalid={invalid('bio')}
        />
      </Field>

      <Field label={labels.notes} htmlFor="teacher-notes" error={fieldErrors.notes?.[0]}>
        <Textarea
          id="teacher-notes"
          name="notes"
          defaultValue={values.notes}
          maxLength={1000}
          invalid={invalid('notes')}
        />
      </Field>

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
