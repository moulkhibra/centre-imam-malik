import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas px-4 text-center">
      <p className="text-5xl font-bold text-brand-600">404</p>
      <h1 className="text-lg font-semibold text-ink-900">Page introuvable</h1>
      <p className="max-w-md text-sm text-ink-500">
        La page demandée n&apos;existe pas ou a été déplacée.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
      >
        Retour au tableau de bord
      </Link>
    </main>
  );
}
