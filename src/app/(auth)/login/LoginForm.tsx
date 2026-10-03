'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, Field, Input, Spinner } from '@/components/ui';
import { loginAction, type LoginState } from '@/actions/auth';

/** Everything this form says, so the Arabic screen does not answer in French. */
export type LoginLabels = {
  email: string;
  password: string;
  signIn: string;
  signingIn: string;
};

function SubmitButton({ labels }: { labels: LoginLabels }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? <Spinner /> : null}
      {pending ? labels.signingIn : labels.signIn}
    </Button>
  );
}

export function LoginForm({ labels }: { labels: LoginLabels }) {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? (
        <Alert tone="danger" errorKey={state.errorKey}>
          {state.error}
        </Alert>
      ) : null}

      <Field label={labels.email} htmlFor="email" required error={state.fieldErrors?.email?.[0]}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          dir="ltr"
          required
          autoFocus
          invalid={Boolean(state.fieldErrors?.email)}
          placeholder="admin@centre.local"
        />
      </Field>

      <Field label={labels.password} htmlFor="password" required error={state.fieldErrors?.password?.[0]}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          dir="ltr"
          required
          invalid={Boolean(state.fieldErrors?.password)}
        />
      </Field>

      <SubmitButton labels={labels} />
    </form>
  );
}
