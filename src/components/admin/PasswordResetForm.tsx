'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Alert,
  Button,
  Field,
  Input,
  Spinner,
} from '@/components/ui';
import { resetUserPasswordAction } from '@/actions/users';
import { passwordResetSchema } from '@/lib/validation/users';
import type { ErrorMessage } from '@/lib/validation/messages';
import type { FieldErrorMap, UsersViewLabels } from '@/components/admin/types';

/**
 * Administrator-initiated password reset.
 *
 * The password and its confirmation are compared by `passwordResetSchema` before
 * the action is called, so the mistake is reported on the field that has to
 * change rather than as a banner. The action parses the same schema again and
 * then does the three things a reset must do: store the hash, force the change
 * at the next login, and revoke the open sessions.
 *
 * The typed password never crosses into a prop, a log line or the journal: the
 * entry lives in the input only.
 */

export type PasswordResetState = {
  ok: boolean;
  error?: string;
  errorKey?: ErrorMessage;
  fieldErrors?: FieldErrorMap;
};

const INITIAL_STATE: PasswordResetState = { ok: false };

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
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? <Spinner /> : null}
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function PasswordResetForm({
  recordId,
  targetLabel,
  labels,
  onCancel,
  onSaved,
}: {
  recordId: string;
  /** "Amine Alaoui — admin@centre.tld", built by the caller. */
  targetLabel: string;
  labels: UsersViewLabels;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, formAction] = useActionState<PasswordResetState, FormData>(
    async (_previous, formData) => {
      const parsed = passwordResetSchema.safeParse(Object.fromEntries(formData.entries()));
      if (!parsed.success) {
        return {
          ok: false,
          error: labels.error,
          fieldErrors: issuesToFieldErrors(parsed.error.issues),
        };
      }

      try {
        const result = await resetUserPasswordAction(recordId, formData);
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

      <p className="text-sm text-ink-700">{targetLabel}</p>
      <p className="text-sm text-ink-600">{labels.resetPasswordHint}</p>

      <Field
        label={labels.newPassword}
        htmlFor="user-reset-password"
        required
        error={fieldErrors.password?.[0]}
      >
        <Input
          id="user-reset-password"
          name="password"
          type="password"
          dir="ltr"
          required
          autoComplete="new-password"
          maxLength={128}
          invalid={invalid('password')}
        />
      </Field>

      <Field
        label={labels.confirmPassword}
        htmlFor="user-reset-password-confirm"
        required
        error={fieldErrors.confirmPassword?.[0]}
      >
        <Input
          id="user-reset-password-confirm"
          name="confirmPassword"
          type="password"
          dir="ltr"
          required
          autoComplete="new-password"
          maxLength={128}
          invalid={invalid('confirmPassword')}
        />
      </Field>

      <div className="flex justify-end gap-2 border-t border-ink-200 pt-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={state.ok}>
          {labels.cancel}
        </Button>
        <SubmitButton label={labels.resetPassword} pendingLabel={labels.loading} />
      </div>
    </form>
  );
}