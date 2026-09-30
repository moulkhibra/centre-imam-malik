'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, Field, Input, Spinner } from '@/components/ui';
import { loginAction, type LoginState } from '@/actions/auth';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? <Spinner /> : null}
      {pending ? 'Connexion…' : 'Se connecter'}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Field label="Adresse e-mail" htmlFor="email" required error={state.fieldErrors?.email?.[0]}>
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

      <Field label="Mot de passe" htmlFor="password" required error={state.fieldErrors?.password?.[0]}>
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

      <SubmitButton />
    </form>
  );
}
