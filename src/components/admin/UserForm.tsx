'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useState } from 'react';
import {
  Alert,
  Button,
  Field,
  Input,
  Select,
  Spinner,
} from '@/components/ui';
import { createUserAction, updateUserAction } from '@/actions/users';
import { userCreateSchema, userUpdateSchema } from '@/lib/validation/users';
import type { ErrorMessage } from '@/lib/validation/messages';
import type {
  FieldErrorMap,
  TeacherOptionView,
  UserCreateValues,
  UserFormValues,
  UsersViewLabels,
  ValueLabels,
} from '@/components/admin/types';

export type { UserFormValues };

/**
 * Create / edit form for one account.
 *
 * The two modes share every input and differ in one: the create form carries
 * the initial password, the edit form has no password field at all. Changing a
 * password is a separate confirmed operation (it revokes the open sessions and
 * is written to the journal as PASSWORD_RESET), so it must not be reachable by
 * a stray keystroke in the identity form.
 *
 * The same Zod schema runs here and in the action. The form runs it so the user
 * sees the problem without a round-trip; the action runs it because that is the
 * copy that protects the table.
 */

export type UserFormState = {
  ok: boolean;
  error?: string;
  errorKey?: ErrorMessage;
  fieldErrors?: FieldErrorMap;
  savedId?: string;
  /**
   * What was submitted, kept so a refused submission can be corrected instead
   * of retyped.
   *
   * React resets an uncontrolled form once its action returns, so the inputs
   * come back empty whatever the outcome. On a rejected submission that means the
   * secretary retypes an address and a full name because one field was wrong -
   * and, on a screen whose whole job is setting a password, retype the password
   * with it. The values are carried in the state and the inputs are remounted
   * with them.
   *
   * The password is the exception: it is deliberately not restored, so a refused
   * password never comes back from the server into the DOM.
   */
  submitted?: Record<string, string>;
  /** Increments per refused submission, so an identical second refusal still remounts. */
  attempt?: number;
};

const INITIAL_STATE: UserFormState = { ok: false };

/**
 * Drops blank values from a submission.
 *
 * An untouched `<input>` submits `""`, which a closed set such as the role enum
 * rejects even though "not chosen" is what `.optional()` describes. Removing the
 * empty entries makes an untouched field absent; a request that deliberately
 * posts `role=` is still refused by the server.
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

export function UserForm({
  recordId,
  values,
  roleLabels,
  localeLabels,
  teacherOptions,
  labels,
  onCancel,
  onSaved,
}: {
  recordId: string | null;
  values: UserCreateValues | UserFormValues;
  roleLabels: ValueLabels;
  localeLabels: ValueLabels;
  teacherOptions: TeacherOptionView[];
  labels: UsersViewLabels;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, formAction] = useActionState<UserFormState, FormData>(
    async (previous, rawFormData) => {
      const formData = withoutBlanks(rawFormData);
      const schema = recordId ? userUpdateSchema : userCreateSchema;
      const attempt = (previous.attempt ?? 0) + 1;

      // Everything except the password: the fields a refusal must not cost the
      // user, and the one field it must not put back into the page.
      const submitted = Object.fromEntries(
        [...formData.entries()]
          .filter(([key, value]) => key !== 'password' && typeof value === 'string')
          .map(([key, value]) => [key, String(value)]),
      );

      const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
      if (!parsed.success) {
        return {
          ok: false,
          error: labels.error,
          fieldErrors: issuesToFieldErrors(parsed.error.issues),
          submitted,
          attempt,
        };
      }

      try {
        const result = recordId
          ? await updateUserAction(recordId, formData)
          : await createUserAction(formData);

        if (result.ok) {
          onSaved();
          return { ok: true, savedId: result.data.id };
        }
        return {
          ok: false,
          error: result.error,
          errorKey: result.errorKey,
          fieldErrors: result.fieldErrors,
          submitted,
          attempt,
        };
      } catch {
        // The actions catch their own errors, so this branch means the transport
        // itself failed: report it rather than tearing the page down.
        return { ok: false, error: labels.error, submitted, attempt };
      }
    },
    INITIAL_STATE,
  );

  /**
   * What an input shows: the refused submission if there was one, otherwise the
   * record as the server resolved it.
   */
  const shown = (name: 'email' | 'phone' | 'firstName' | 'lastName' | 'teacherId' | 'locale') =>
    state.submitted?.[name] ?? String(values[name]);

  const fieldErrors = state.fieldErrors ?? {};
  const invalid = (name: string) => Boolean(fieldErrors[name]);

  // Controlled so the teacher select can appear and disappear with the role: a
  // TEACHER account is the only one that can be linked to a catalogue record.
  const [role, setRole] = useState(values.role);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? (
        <Alert tone="danger" errorKey={state.errorKey}>
          {state.error}
        </Alert>
      ) : null}

      {/* Keyed on the attempt count: `defaultValue` is only read when an input
          mounts, so without this the restored values would sit in the state and
          never reach the page. */}
      <div className="grid gap-3 sm:grid-cols-2" key={state.attempt ?? 0}>
        <Field label={labels.email} htmlFor="user-email" required error={fieldErrors.email?.[0]}>
          <Input
            id="user-email"
            name="email"
            type="email"
            defaultValue={shown('email')}
            dir="ltr"
            required
            autoComplete="off"
            maxLength={160}
            invalid={invalid('email')}
          />
        </Field>

        <Field label={labels.phone} htmlFor="user-phone" error={fieldErrors.phone?.[0]}>
          <Input
            id="user-phone"
            name="phone"
            type="tel"
            defaultValue={shown('phone')}
            dir="ltr"
            maxLength={25}
            invalid={invalid('phone')}
          />
        </Field>

        <Field label={labels.lastName} htmlFor="user-lastName" required error={fieldErrors.lastName?.[0]}>
          <Input
            id="user-lastName"
            name="lastName"
            defaultValue={shown('lastName')}
            dir="ltr"
            required
            maxLength={80}
            invalid={invalid('lastName')}
          />
        </Field>

        <Field label={labels.firstName} htmlFor="user-firstName" required error={fieldErrors.firstName?.[0]}>
          <Input
            id="user-firstName"
            name="firstName"
            defaultValue={shown('firstName')}
            dir="ltr"
            required
            maxLength={80}
            invalid={invalid('firstName')}
          />
        </Field>

        <Field label={labels.role} htmlFor="user-role" required error={fieldErrors.role?.[0]}>
          <Select
            id="user-role"
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            invalid={invalid('role')}
          >
            {Object.keys(roleLabels).map((value) => (
              <option key={value} value={value}>
                {roleLabels[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={labels.language} htmlFor="user-locale" required error={fieldErrors.locale?.[0]}>
          <Select
            id="user-locale"
            name="locale"
            defaultValue={shown('locale')}
            invalid={invalid('locale')}
          >
            {Object.keys(localeLabels).map((value) => (
              <option key={value} value={value}>
                {localeLabels[value]}
              </option>
            ))}
          </Select>
        </Field>

        {role === 'TEACHER' ? (
          <div className="sm:col-span-2">
            <Field
              label={labels.teacher}
              htmlFor="user-teacherId"
              error={fieldErrors.teacherId?.[0]}
            >
              <Select
                id="user-teacherId"
                name="teacherId"
                defaultValue={shown('teacherId')}
                invalid={invalid('teacherId')}
              >
                <option value="">{labels.none}</option>
                {teacherOptions.map((option) => (
                  <option key={option.id} value={option.id} disabled={!option.isCurrent && Boolean(option.takenBy)}>
                    {option.label}
                    {option.takenBy ? ` — ${option.takenBy}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="mt-1 text-xs text-ink-500">
              {teacherOptions.length === 0 ? labels.noTeachers : labels.teacherHint}
            </p>
          </div>
        ) : null}

        {!recordId ? (
          <div className="sm:col-span-2">
            <Field
              label={labels.initialPassword}
              htmlFor="user-password"
              required
              error={fieldErrors.password?.[0]}
            >
              <Input
                id="user-password"
                name="password"
                type="password"
                dir="ltr"
                required
                autoComplete="new-password"
                maxLength={128}
                invalid={invalid('password')}
              />
            </Field>
            <p className="mt-1 text-xs text-ink-500">{labels.initialPasswordHint}</p>
          </div>
        ) : null}
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