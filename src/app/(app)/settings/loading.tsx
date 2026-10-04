import { Skeleton } from '@/components/ui';

/**
 * Loading skeleton for the centre settings screen.
 *
 * Four cards of a two-column grid, matching the sections the form renders, so the
 * inputs are already where the eye expects them when the values arrive.
 */
export default function SettingsLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      {Array.from({ length: 4 }, (_, section) => (
        <div key={section} className="rounded-xl border border-ink-200 bg-white p-4">
          <div className="mb-3 border-b border-ink-200 pb-2">
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, field) => (
              <div key={field} className="flex flex-col gap-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <Skeleton className="h-11 w-32" />
      </div>
    </div>
  );
}