'use client';

import { useEffect } from 'react';
import { Button, ErrorState, PageHeader } from '@/components/ui';

/**
 * Route-level error boundary for the rooms catalogue.
 *
 * A failed query must not take the whole application down: the shell and the
 * navigation stay usable, and the user gets a retry that re-runs the segment.
 *
 * The wording is literal rather than translated, exactly like the students
 * boundary: an error boundary is a Client Component, so it cannot read the
 * cookie-backed translator. The full error stays server-side, only the digest is
 * safe to show.
 */
export default function RoomsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[rooms] catalogue failed', error.digest ?? error.message);
  }, [error]);

  return (
    <>
      <PageHeader title="Salles" description="Catalogue des salles du centre" />
      <ErrorState
        title="Le catalogue des salles n'a pas pu être chargé"
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