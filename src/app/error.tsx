'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Full detail stays server-side; the digest is safe to show for support.
    console.error('[app] unhandled error', error.digest ?? error.message);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas px-4 text-center">
      <h1 className="text-lg font-semibold text-ink-900">Une erreur est survenue</h1>
      <p className="max-w-md text-sm text-ink-500">
        L&apos;opération n&apos;a pas pu aboutir. Aucune donnée n&apos;a été modifiée.
      </p>
      {error.digest ? <p className="text-xs text-ink-500">Référence : {error.digest}</p> : null}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
        >
          Réessayer
        </button>
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center rounded-lg border border-ink-300 bg-white px-4 text-sm font-medium text-ink-700 hover:bg-ink-100"
        >
          Tableau de bord
        </Link>
      </div>
    </main>
  );
}
