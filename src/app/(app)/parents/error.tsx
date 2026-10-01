'use client';

import { useEffect } from 'react';
import { Button, ErrorState, PageHeader } from '@/components/ui';

/**
 * Route-level error boundary for the parents list.
 *
 * Wording is literal for the same reason as `src/app/error.tsx` and the students
 * boundary: a Client Component cannot read the cookie-backed translator.
 */
export default function ParentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[parents] list failed', error.digest ?? error.message);
  }, [error]);

  return (
    <>
      <PageHeader title="Parents" description="Liste des parents et tuteurs" />
      <ErrorState
        title="La liste des parents n'a pas pu être chargée"
        description={
          error.digest
            ? `Aucune donnée n'a été modifiée. Référence : ${error.digest}`
            : "Aucune donnée n'a été modifiée."
        }
        action={<Button variant="secondary" onClick={reset}>Réessayer</Button>}
      />
    </>
  );
}
