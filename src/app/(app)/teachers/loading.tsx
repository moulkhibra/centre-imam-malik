import { Skeleton } from '@/components/ui';

/**
 * Loading skeleton for the teachers list.
 *
 * Same shape as the students one - toolbar, table, pagination - so the page
 * does not jump when the rows arrive. Only the status filter is stubbed, which
 * is the one filter this screen has.
 */
export default function TeachersLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-36" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
        <div className="border-b border-ink-200 bg-ink-50 px-3 py-2.5">
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 border-b border-ink-100 px-3 py-3 last:border-b-0">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-52" />
      </div>
    </div>
  );
}
