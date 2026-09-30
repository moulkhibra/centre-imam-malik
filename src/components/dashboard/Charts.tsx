'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMad, monthLabel } from '@/lib/utils/format';
import type { Locale } from '@/lib/constants';
import { cn } from '@/lib/utils/cn';

const PALETTE = ['#0f766e', '#f59e0b', '#2563eb', '#dc2626', '#7c3aed', '#059669', '#db2777', '#64748b'];

function TooltipBox({ active, payload, label, locale, money }: { active?: boolean; payload?: { name?: string; value?: number | string; color?: string }[]; label?: string | number; locale: Locale; money?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-ink-900">{String(label ?? '')}</p>
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-1.5 text-ink-700">
          <span className="size-2 rounded-full" style={{ background: entry.color }} aria-hidden="true" />
          {entry.name}: {typeof entry.value === 'number' && money ? formatMad(entry.value, locale) : String(entry.value)}
        </p>
      ))}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-56 items-center justify-center px-4 text-center text-sm text-ink-500">
      {message}
    </div>
  );
}

export function RevenueBarChart({ data, locale, empty }: { data: { month: number; year: number; totalCents: number }[]; locale: Locale; empty: string }) {
  if (data.every((d) => d.totalCents === 0)) return <EmptyChart message={empty} />;

  const chartData = data.map((d) => ({
    name: monthLabel(d.month, locale),
    value: d.totalCents / 100,
  }));

  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={48} />
          <Tooltip content={<TooltipBox locale={locale} money />} cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey="value" name="Revenus" fill="#0f766e" radius={[4, 4, 0, 0]} maxBarSize={38} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RegistrationsLineChart({ data, locale, empty }: { data: { month: number; year: number; count: number }[]; locale: Locale; empty: string }) {
  if (data.every((d) => d.count === 0)) return <EmptyChart message={empty} />;

  const chartData = data.map((d) => ({ name: monthLabel(d.month, locale), value: d.count }));

  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={32} />
          <Tooltip content={<TooltipBox locale={locale} />} />
          <Line type="monotone" dataKey="value" name="Inscriptions" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AttendanceLineChart({ data, locale, empty }: { data: { month: number; year: number; rate: number }[]; locale: Locale; empty: string }) {
  if (data.every((d) => d.rate === 0)) return <EmptyChart message={empty} />;

  const chartData = data.map((d) => ({ name: monthLabel(d.month, locale), value: d.rate }));

  return (
    <div className="h-56 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} unit="%" />
          <Tooltip content={<TooltipBox locale={locale} />} />
          <Line type="monotone" dataKey="value" name="Taux de présence" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DistributionPieChart({
  data,
  empty,
  nameKey = 'label',
  valueKey = 'value',
  centerLabel,
}: {
  data: Record<string, string | number>[];
  empty: string;
  nameKey?: string;
  valueKey?: string;
  centerLabel?: string;
}) {
  if (data.length === 0) return <EmptyChart message={empty} />;

  const total = data.reduce((sum, d) => sum + Number(d[valueKey] ?? 0), 0);

  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            innerRadius="48%"
            outerRadius="76%"
            paddingAngle={2}
            label={({ name, percent }: { name?: string; percent?: number }) =>
              `${name ?? ''} ${Math.round((percent ?? 0) * 100)}%`
            }
            labelLine={false}
            style={{ fontSize: 11 }}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Tooltip formatter={(value: number | string) => `${value} ${centerLabel ?? ''}`.trim()} />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel ? <p className="sr-only">{total}</p> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sublabel,
  icon,
  tone = 'neutral',
  href,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon?: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';
  href?: string;
}) {
  const tones = {
    neutral: 'text-ink-900',
    success: 'text-ok-600',
    warning: 'text-warn-600',
    danger: 'text-danger-600',
    info: 'text-info-600',
    brand: 'text-brand-700',
  } as const;

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-ink-500">{label}</p>
        {icon ? <span className="shrink-0 text-ink-300">{icon}</span> : null}
      </div>
      <p className={cn('num mt-1.5 text-2xl font-semibold tracking-tight', tones[tone])}>{value}</p>
      {sublabel ? <p className="mt-0.5 truncate text-[11px] text-ink-500">{sublabel}</p> : null}
    </>
  );

  if (href) {
    return (
      <a href={href} className="card block p-4 transition-colors hover:border-brand-600/40 hover:bg-brand-50/30">
        {content}
      </a>
    );
  }
  return <div className="card p-4">{content}</div>;
}
