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
import { createStudentAction, updateStudentAction } from '@/actions/students';
import { studentCreateSchema } from '@/lib/validation/people';
import type {
  FieldErrorMap,
  LevelOptionView,
  PeopleLabels,
  StudentFormValues,
  ValueLabels,
} from '@/components/people/types';

/**
 * Create / edit form for one student.
 *
 * The parent passes a `key` derived from the record, so switching from one
 * student to another remounts the form and its action state instead of leaving
 * the previous record's errors on screen.
 *
 * Validation runs twice with the *same* Zod schema: once here, so the secretary
 * sees the problem without a round-trip, and once inside the Server Action,
 * which is the copy that actually protects the database. The payload sent to
 * the server is the very FormData that was validated here, so the two copies
 * can never disagree.
 */

export type StudentFormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: FieldErrorMap;
  savedId?: string;
};

const INITIAL_STATE: StudentFormState = { ok: false };

/**
 * Drops blank values from a submission.
 *
 * An `<input>`/`<select>` that the user left empty still submits `""`, and a
 * closed set such as `z.enum(GENDERS)` rejects that even though "not chosen"
 * is exactly what its `.optional()` describes. Removing the empty entries makes
 * an untouched field absent, which is what the schema expects, while a
 * deliberately rejected request that posts `gender=` is still refused by the
 * server.
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

export function StudentForm({
  recordId,
  values,
  levelOptions,
  statusLabels,
  genderLabels,
  labels,
  onCancel,
  onSaved,
}: {
  recordId: string | null;
  values: StudentFormValues;
  levelOptions: LevelOptionView[];
  statusLabels: ValueLabels;
  genderLabels: ValueLabels;
  labels: PeopleLabels;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, formAction] = useActionState<StudentFormState, FormData>(
    async (_previous, rawFormData) => {
      const formData = withoutBlanks(rawFormData);

      const parsed = studentCreateSchema.safeParse(Object.fromEntries(formData.entries()));
      if (!parsed.success) {
        return {
          ok: false,
          error: labels.error,
          fieldErrors: issuesToFieldErrors(parsed.error.issues),
        };
      }

      try {
        const result = recordId
          ? await updateStudentAction(recordId, formData)
          : await createStudentAction(formData);

        if (result.ok) {
          onSaved();
          return { ok: true, savedId: result.data.id };
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
        <Field
          label={`${labels.code} (${labels.optional})`}
          htmlFor="student-code"
          error={fieldErrors.code?.[0]}
        >
          <Input
            id="student-code"
            name="code"
            defaultValue={values.code}
            dir="ltr"
            maxLength={20}
            placeholder="ELE-0001"
            invalid={invalid('code')}
          />
        </Field>

        <Field
          label={labels.status}
          htmlFor="student-status"
          error={fieldErrors.status?.[0]}
        >
          <Select id="student-status" name="status" defaultValue={values.status} invalid={invalid('status')}>
            {Object.keys(statusLabels).map((value) => (
              <option key={value} value={value}>
                {statusLabels[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={labels.lastName}
          htmlFor="student-lastName"
          required
          error={fieldErrors.lastName?.[0]}
        >
          <Input
            id="student-lastName"
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
          htmlFor="student-firstName"
          required
          error={fieldErrors.firstName?.[0]}
        >
          <Input
            id="student-firstName"
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
          htmlFor="student-lastNameAr"
          error={fieldErrors.lastNameAr?.[0]}
        >
          <Input
            id="student-lastNameAr"
            name="lastNameAr"
            defaultValue={values.lastNameAr}
            dir="rtl"
            maxLength={80}
            invalid={invalid('lastNameAr')}
          />
        </Field>

        <Field
          label={labels.firstNameAr}
          htmlFor="student-firstNameAr"
          error={fieldErrors.firstNameAr?.[0]}
        >
          <Input
            id="student-firstNameAr"
            name="firstNameAr"
            defaultValue={values.firstNameAr}
            dir="rtl"
            maxLength={80}
            invalid={invalid('firstNameAr')}
          />
        </Field>

        <Field
          label={labels.birthDate}
          htmlFor="student-birthDate"
          error={fieldErrors.birthDate?.[0]}
        >
          <Input
            id="student-birthDate"
            name="birthDate"
            type="date"
            defaultValue={values.birthDate}
            dir="ltr"
            invalid={invalid('birthDate')}
          />
        </Field>

        <Field label={labels.gender} htmlFor="student-gender" error={fieldErrors.gender?.[0]}>
          <Select
            id="student-gender"
            name="gender"
            defaultValue={values.gender}
            dir="ltr"
            invalid={invalid('gender')}
          >
            <option value="">{labels.none}</option>
            {Object.keys(genderLabels).map((value) => (
              <option key={value} value={value}>
                {genderLabels[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={labels.level} htmlFor="student-levelId" error={fieldErrors.levelId?.[0]}>
          <Select
            id="student-levelId"
            name="levelId"
            defaultValue={values.levelId}
            invalid={invalid('levelId')}
          >
            <option value="">{labels.none}</option>
            {levelOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={labels.cin} htmlFor="student-cin" error={fieldErrors.cin?.[0]}>
          <Input
            id="student-cin"
            name="cin"
            defaultValue={values.cin}
            dir="ltr"
            maxLength={10}
            placeholder="AB123456"
            invalid={invalid('cin')}
          />
        </Field>

        <Field label={labels.phone} htmlFor="student-phone" error={fieldErrors.phone?.[0]}>
          <Input
            id="student-phone"
            name="phone"
            type="tel"
            defaultValue={values.phone}
            dir="ltr"
            maxLength={25}
            invalid={invalid('phone')}
          />
        </Field>

        <Field label={labels.whatsapp} htmlFor="student-whatsapp" error={fieldErrors.whatsapp?.[0]}>
          <Input
            id="student-whatsapp"
            name="whatsapp"
            type="tel"
            defaultValue={values.whatsapp}
            dir="ltr"
            maxLength={25}
            invalid={invalid('whatsapp')}
          />
        </Field>

        <Field label={labels.email} htmlFor="student-email" error={fieldErrors.email?.[0]}>
          <Input
            id="student-email"
            name="email"
            type="email"
            defaultValue={values.email}
            dir="ltr"
            maxLength={160}
            invalid={invalid('email')}
          />
        </Field>

        <Field label={labels.school} htmlFor="student-school" error={fieldErrors.school?.[0]}>
          <Input
            id="student-school"
            name="school"
            defaultValue={values.school}
            maxLength={120}
            invalid={invalid('school')}
          />
        </Field>

        <Field label={labels.city} htmlFor="student-city" error={fieldErrors.city?.[0]}>
          <Input
            id="student-city"
            name="city"
            defaultValue={values.city}
            maxLength={80}
            invalid={invalid('city')}
          />
        </Field>
      </div>

      <Field label={labels.address} htmlFor="student-address" error={fieldErrors.address?.[0]}>
        <Input
          id="student-address"
          name="address"
          defaultValue={values.address}
          maxLength={200}
          invalid={invalid('address')}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={labels.emergencyContact}
          htmlFor="student-emergencyContactName"
          error={fieldErrors.emergencyContactName?.[0]}
        >
          <Input
            id="student-emergencyContactName"
            name="emergencyContactName"
            defaultValue={values.emergencyContactName}
            maxLength={120}
            invalid={invalid('emergencyContactName')}
          />
        </Field>

        <Field
          label={`${labels.phone} (${labels.emergencyContact})`}
          htmlFor="student-emergencyContactPhone"
          error={fieldErrors.emergencyContactPhone?.[0]}
        >
          <Input
            id="student-emergencyContactPhone"
            name="emergencyContactPhone"
            type="tel"
            defaultValue={values.emergencyContactPhone}
            dir="ltr"
            maxLength={25}
            invalid={invalid('emergencyContactPhone')}
          />
        </Field>
      </div>

      <Field label={labels.notes} htmlFor="student-notes" error={fieldErrors.notes?.[0]}>
        <Textarea
          id="student-notes"
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
