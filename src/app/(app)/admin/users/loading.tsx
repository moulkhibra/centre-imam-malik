import { Skeleton } from '@/components/ui';

/**
 * Loading skeleton for the accounts list.
 *
 * Same shape as the other people lists - toolbar, table, pagination - so the
 * screen does not jump when the rows arrive. One row is stubbed per visible
 * column, and the actions column is stubbed even for a reader who will not get
 * any: the table must not change width once the permissions are known.
 */
export default function UsersLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-40" />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {['w-36', 'w-32', 'w-40'].map((width) => (
          <div key={width} className="flex flex-col gap-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className={`h-8 ${width}`} />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
        <div className="border-b border-ink-200 bg-ink-50 px-3 py-2.5">
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 border-b border-ink-100 px-3 py-3 last:border-b-0">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
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