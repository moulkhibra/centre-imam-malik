'use client';

import { cn } from '@/lib/utils/cn';
import { resolveErrorMessage, resolveMessage, type ErrorMessage } from '@/lib/validation/messages';
import { useErrorMessages, useValidationMessages } from '@/components/validation-messages';
import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

// --- Button -----------------------------------------------------------------

const BUTTON_VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500',
  secondary: 'bg-white text-ink-700 border border-ink-300 hover:bg-ink-100 focus-visible:ring-ink-400',
  ghost: 'text-ink-700 hover:bg-ink-100 focus-visible:ring-ink-400',
  danger: 'bg-danger-600 text-white hover:brightness-95 focus-visible:ring-danger-600',
  subtle: 'bg-ink-100 text-ink-700 hover:bg-ink-200 focus-visible:ring-ink-400',
} as const;

const BUTTON_SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-sm gap-2',
  icon: 'h-10 w-10 p-0',
  iconSm: 'h-8 w-8 p-0',
} as const;

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;
export type ButtonSize = keyof typeof BUTTON_SIZES;

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string): string {
  return cn(
    'inline-flex items-center justify-center rounded-lg font-medium transition-colors select-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
    'disabled:pointer-events-none disabled:opacity-50',
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return <button type="button" className={buttonClasses(variant, size, className)} {...props} />;
}

// --- Form fields ------------------------------------------------------------

export function Label({ className, required, children, ...props }: LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn('block text-sm font-medium text-ink-700 mb-1', className)} {...props}>
      {children}
      {required ? <span className="text-danger-600 ms-0.5" aria-hidden="true">*</span> : null}
    </label>
  );
}

const FIELD_BASE =
  'w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 ' +
  'placeholder:text-ink-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ' +
  'disabled:bg-ink-100 disabled:text-ink-500 read-only:bg-ink-100';

export function Input({ className, invalid, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={cn(FIELD_BASE, invalid && 'border-danger-600 focus:ring-danger-600', className)} {...props} />;
}

export function Textarea({ className, invalid, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(FIELD_BASE, 'min-h-20 resize-y', invalid && 'border-danger-600 focus:ring-danger-600', className)}
      {...props}
    />
  );
}

export function Select({ className, invalid, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select className={cn(FIELD_BASE, 'pe-8', invalid && 'border-danger-600', className)} {...props}>
      {children}
    </select>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-danger-600">{children}</p>;
}

export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  required?: boolean;
  error?: string | string[] | undefined;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const messages = useValidationMessages();
  const errorTexts = useErrorMessages();
  const raw = Array.isArray(error) ? error[0] : error;
  // A validation rule stores a `validation.*` key, and a Server Action pushes an
  // `errors.*` key for the field it blames (a duplicate code, a wrong current
  // password). Both are turned into text here; anything else arrives as it stands.
  const message =
    raw && messages && errorTexts ? resolveMessage(raw, messages, errorTexts) : raw;
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {message ? <FieldError>{message}</FieldError> : hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

// --- Badge ------------------------------------------------------------------

const BADGE_TONES = {
  neutral: 'bg-ink-100 text-ink-700 border-ink-200',
  success: 'bg-ok-50 text-ok-600 border-ok-600/20',
  warning: 'bg-warn-50 text-warn-600 border-warn-600/20',
  danger: 'bg-danger-50 text-danger-600 border-danger-600/20',
  info: 'bg-info-50 text-info-600 border-info-600/20',
  brand: 'bg-brand-50 text-brand-700 border-brand-600/20',
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({ tone = 'neutral', className, children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// --- Layout -----------------------------------------------------------------

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('card', className)}>{children}</div>;
}

export function CardHeader({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-ink-200 px-4 py-3', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-ink-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageHeader({ title, description, actions, breadcrumb }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; breadcrumb?: ReactNode }) {
  return (
    <div className="mb-4">
      {breadcrumb ? <div className="mb-2">{breadcrumb}</div> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">{title}</h1>
          {description ? <p className="mt-1 text-sm text-ink-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon ? <div className="text-ink-300">{icon}</div> : null}
      <p className="text-sm font-medium text-ink-700">{title}</p>
      {description ? <p className="max-w-md text-sm text-ink-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-danger-600/30 bg-danger-50 px-6 py-8 text-center">
      <p className="text-sm font-semibold text-danger-600">{title}</p>
      {description ? <p className="text-sm text-ink-700">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/**
 * Busy indicator.
 *
 * Without an `ariaLabel` the spinner is `aria-hidden`: every call site so far
 * puts it inside a `<Button>` that already carries the state in its own name
 * ("Enregistrement…", "Réessayer"), so announcing a second one only repeats
 * the button. A spinner that stands on its own passes the label of the screen it
 * belongs to, resolved in the reader's language by the caller.
 *
 * The French literal this used to hardcode is what made it impossible to render
 * the component on an Arabic screen without an untranslated string.
 */
export function Spinner({ className, ariaLabel }: { className?: string; ariaLabel?: string }) {
  return (
    <span
      {...(ariaLabel
        ? ({ role: 'status', 'aria-label': ariaLabel } as const)
        : ({ 'aria-hidden': 'true' } as const))}
      className={cn('inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent', className)}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-ink-200', className)} />;
}

// --- Modal ------------------------------------------------------------------

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  if (!open) return null;
  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl' }[size];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/50 p-4 pt-[10vh]"
      role="dialog"
      aria-modal="true"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className={cn('relative w-full rounded-xl bg-white shadow-xl', width)}>
        <div className="flex items-start justify-between gap-3 border-b border-ink-200 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-ink-900">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-ink-500">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-md p-1 text-ink-500 hover:bg-ink-100">
            <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-ink-200 px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

/**
 * `errorKey` is an `errors.*` key from a Server Action result.
 *
 * The action that produced the message runs outside any request-time locale, so
 * what it returns cannot be a sentence: the banner is where the locale is known,
 * so this is where the key becomes text. The French `error` string is still
 * passed as `children` by every form and is used when there is no key, which is
 * what keeps a result we failed to key from rendering an empty box.
 */
export function Alert({
  tone = 'info',
  title,
  errorKey,
  children,
  className,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: ReactNode;
  errorKey?: ErrorMessage;
  children?: ReactNode;
  className?: string;
}) {
  const errorTexts = useErrorMessages();
  const message = errorKey && errorTexts ? resolveErrorMessage(errorKey, errorTexts) : null;
  const tones = {
    info: 'border-info-600/30 bg-info-50 text-ink-900',
    success: 'border-ok-600/30 bg-ok-50 text-ink-900',
    warning: 'border-warn-600/30 bg-warn-50 text-ink-900',
    danger: 'border-danger-600/30 bg-danger-50 text-ink-900',
  } as const;

  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('rounded-lg border px-3 py-2 text-sm', tones[tone], className)}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {message ?? children}
    </div>
  );
}

// --- Icons (inline, no external dependency, RTL-safe) -----------------------

type IconProps = { className?: string };

const svg = (path: ReactNode, className?: string) => (
  <svg viewBox="0 0 24 24" className={className ?? 'size-5'} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
);

export const IconDashboard = ({ className }: IconProps) => svg(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>, className);
export const IconUsers = ({ className }: IconProps) => svg(<><path d="M16 19v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V19" /><circle cx="9" cy="7" r="3.2" /><path d="M22 19v-1.5a4 4 0 0 0-3-3.87" /><path d="M16 4.13a4 4 0 0 1 0 7.75" /></>, className);
export const IconUser = ({ className }: IconProps) => svg(<><path d="M19 20v-1.5a5 5 0 0 0-5-5h-4a5 5 0 0 0-5 5V20" /><circle cx="12" cy="7" r="3.5" /></>, className);
export const IconTeacher = ({ className }: IconProps) => svg(<><path d="M3 21h18" /><path d="M6 21V9l6-5 6 5v12" /><path d="M10 21v-5h4v5" /></>, className);
export const IconBook = ({ className }: IconProps) => svg(<><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19a2 2 0 0 1 2-2h13" /></>, className);
export const IconLayers = ({ className }: IconProps) => svg(<><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /><path d="M3 17.5l9 5 9-5" /></>, className);
export const IconRoom = ({ className }: IconProps) => svg(<><path d="M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17" /><path d="M15 12h4a1 1 0 0 1 1 1v8" /><path d="M3 21h18" /><path d="M7.5 12.5h.01" /></>, className);
export const IconCalendar = ({ className }: IconProps) => svg(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>, className);
export const IconClipboard = ({ className }: IconProps) => svg(<><path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z" /><rect x="5" y="6" width="14" height="15" rx="2" /><path d="M9 12h6M9 16h4" /></>, className);
export const IconWallet = ({ className }: IconProps) => svg(<><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2" /><rect x="3" y="7" width="18" height="13" rx="2" /><circle cx="16" cy="13.5" r="1.3" /></>, className);
export const IconReceipt = ({ className }: IconProps) => svg(<><path d="M5 3h14v18l-2.3-1.5-2.4 1.5-2.3-1.5L9.7 21l-2.4-1.5L5 21z" /><path d="M9 8h6M9 12h6" /></>, className);
export const IconCash = ({ className }: IconProps) => svg(<><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></>, className);
export const IconChart = ({ className }: IconProps) => svg(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>, className);
export const IconAward = ({ className }: IconProps) => svg(<><circle cx="12" cy="9" r="5" /><path d="M8.5 13.5L7 22l5-2.5L17 22l-1.5-8.5" /></>, className);
export const IconFolder = ({ className }: IconProps) => svg(<><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>, className);
export const IconBell = ({ className }: IconProps) => svg(<><path d="M18 15V10a6 6 0 1 0-12 0v5l-1.5 3h15z" /><path d="M10 21a2 2 0 0 0 4 0" /></>, className);
export const IconSettings = ({ className }: IconProps) => svg(<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" /></>, className);
export const IconKey = ({ className }: IconProps) => svg(<><circle cx="8" cy="15" r="4" /><path d="M11 12l8-8 2 2-2 2 2 2-3 3-2-2-2 2" /></>, className);
export const IconShield = ({ className }: IconProps) => svg(<><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M9.5 12l1.8 1.8L15 10" /></>, className);
export const IconDatabase = ({ className }: IconProps) => svg(<><ellipse cx="12" cy="5.5" rx="8" ry="3" /><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>, className);
export const IconSearch = ({ className }: IconProps) => svg(<><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></>, className);
export const IconPlus = ({ className }: IconProps) => svg(<path d="M12 5v14M5 12h14" />, className);
export const IconEdit = ({ className }: IconProps) => svg(<><path d="M4 20h4l10-10-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>, className);
export const IconTrash = ({ className }: IconProps) => svg(<><path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></>, className);
export const IconLogout = ({ className }: IconProps) => svg(<><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h9" /></>, className);
export const IconGlobe = ({ className }: IconProps) => svg(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z" /></>, className);
export const IconAlert = ({ className }: IconProps) => svg(<><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" /></>, className);
export const IconInbox = ({ className }: IconProps) => svg(<><path d="M3 12h5l1.5 3h5L16 12h5" /><path d="M4.5 5h15l1.5 7v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6z" /></>, className);
export const IconCheck = ({ className }: IconProps) => svg(<path d="M5 12.5l4.5 4.5L19 7.5" />, className);
export const IconMenu = ({ className }: IconProps) => svg(<path d="M4 6h16M4 12h16M4 18h16" />, className);
export const IconFile = ({ className }: IconProps) => svg(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>, className);
