'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert, Button, Field, Input, Spinner } from '@/components/ui';
import { changePasswordAction, type LoginState } from '@/actions/auth';
import type { ActionResult } from '@/lib/utils/errors';

function SubmitButton({ label, saving }: { label: string; saving: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Spinner /> : null}
      {pending ? saving : label}
    </Button>
  );
}

export function ChangePasswordForm({
  description,
  submitLabel,
  forced,
  requirements,
  labels,
}: {
  description: string;
  submitLabel: string;
  forced: boolean;
  requirements: string;
  /** The three field labels, which used to be French literals. */
  labels: { currentPassword: string; newPassword: string; confirmPassword: string; saving: string };
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<LoginState, FormData>(async (prev, formData) => {
    const result: ActionResult<{ mustChangePassword: boolean }> = await changePasswordAction(prev, formData);
    if (result.ok) {
      router.push('/dashboard');
      router.refresh();
      return {};
    }
    return { error: result.error, errorKey: result.errorKey, fieldErrors: result.fieldErrors };
  }, {});

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {forced ? <Alert tone="warning">{description}</Alert> : null}
      {state.error ? (
        <Alert tone="danger" errorKey={state.errorKey}>
          {state.error}
        </Alert>
      ) : null}

      <Field label={labels.currentPassword} htmlFor="currentPassword" required error={state.fieldErrors?.currentPassword?.[0]}>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" dir="ltr" required invalid={Boolean(state.fieldErrors?.currentPassword)} />
      </Field>

      <Field label={labels.newPassword} htmlFor="newPassword" required error={state.fieldErrors?.newPassword?.[0]} hint={requirements}>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" dir="ltr" required invalid={Boolean(state.fieldErrors?.newPassword)} />
      </Field>

      <Field label={labels.confirmPassword} htmlFor="confirmPassword" required error={state.fieldErrors?.confirmPassword?.[0]}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" dir="ltr" required invalid={Boolean(state.fieldErrors?.confirmPassword)} />
      </Field>

      <SubmitButton label={submitLabel} saving={labels.saving} />
    </form>
  );
}
