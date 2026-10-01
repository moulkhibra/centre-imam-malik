import { Skeleton } from '@/components/ui';

/**
 * Loading skeleton for the academics screen.
 *
 * Mirrors the real layout - tab bar, toolbar with its filters, table,
 * pagination - so switching tab or filtering does not jump. Only the active
 * column matters here; the widths are the ones the two tables actually use.
 */
export default function AcademicsLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="flex gap-1 border-b border-ink-200 pb-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-28" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-36" />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="flex flex-col gap-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-36" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
        <div className="border-b border-ink-200 bg-ink-50 px-3 py-2.5">
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 border-b border-ink-100 px-3 py-3 last:border-b-0">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-14" />
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