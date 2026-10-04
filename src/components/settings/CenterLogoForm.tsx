'use client';

import { useActionState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, CardHeader, Label, Spinner } from '@/components/ui';
import { removeCenterLogoAction, uploadCenterLogoAction } from '@/actions/settings';
import type { ErrorMessage } from '@/lib/validation/messages';

/**
 * Uploads or removes the centre logo.
 *
 * A form of its own rather than a field inside the settings form: a file input
 * makes the whole request `multipart/form-data`, so putting one in the settings
 * form would make every name and colour save carry the image along.
 *
 * The file never leaves the machine the operator picked it on - there is no
 * third party in this loop, which is the point of an application that runs on
 * the centre's own PC.
 */

export type CenterLogoLabels = {
  title: string;
  hint: string;
  upload: string;
  uploadDone: string;
  remove: string;
  removeDone: string;
  current: string;
  none: string;
  file: string;
  error: string;
  saving: string;
};

type LogoState = { ok: boolean; done?: string; error?: string; errorKey?: ErrorMessage };

const INITIAL: LogoState = { ok: false };

export function CenterLogoForm({
  logoUrl,
  hasUploadedLogo,
  canManage,
  labels,
}: {
  logoUrl: string | null;
  /** Whether the logo currently shown is an uploaded file rather than a public path. */
  hasUploadedLogo: boolean;
  canManage: boolean;
  labels: CenterLogoLabels;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [state, formAction, pending] = useActionState(
    async (_previous: LogoState, formData: FormData): Promise<LogoState> => {
      try {
        const removing = formData.get('intent') === 'remove';
        const result = removing
          ? await removeCenterLogoAction()
          : await uploadCenterLogoAction(formData);

        if (result.ok) {
          // The sidebar reads the logo in the root layout, so the shell has to
          // re-render as well as this route.
          router.refresh();
          if (fileRef.current) fileRef.current.value = '';
          return { ok: true, done: removing ? labels.removeDone : labels.uploadDone };
        }
        return { ok: false, error: result.error, errorKey: result.errorKey };
      } catch {
        return { ok: false, error: labels.error };
      }
    },
    INITIAL,
  );

  return (
    <Card>
      <CardHeader title={labels.title} description={labels.hint} />
      <div className="space-y-3">
        {state.error ? (
          <Alert tone="danger" errorKey={state.errorKey}>
            {state.error}
          </Alert>
        ) : null}
        {state.done ? <Alert tone="success">{state.done}</Alert> : null}

        <div className="flex flex-wrap items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={labels.current}
              data-testid="center-logo-preview"
              className="size-14 shrink-0 rounded-lg border border-ink-200 bg-white object-contain"
            />
          ) : (
            <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              CIM
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink-900">
              {logoUrl ? labels.current : labels.none}
            </p>

            {canManage ? (
              <form action={formAction} encType="multipart/form-data" className="mt-2 space-y-2">
                <input type="hidden" name="intent" value="upload" />
                <Label htmlFor="center-logo-file" className="sr-only">
                  {labels.file}
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="center-logo-file"
                    ref={fileRef}
                    name="logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="text-sm text-ink-700 file:me-3 file:rounded-lg file:border file:border-ink-200 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink-700"
                  />
                  <Button type="submit" size="sm" disabled={pending}>
                    {pending ? <Spinner className="size-4" ariaLabel={labels.saving} /> : null}
                    {labels.upload}
                  </Button>
                </div>
              </form>
            ) : null}

            {canManage && hasUploadedLogo ? (
              <form action={formAction} className="mt-2">
                <input type="hidden" name="intent" value="remove" />
                <Button type="submit" variant="ghost" size="sm" disabled={pending}>
                  {labels.remove}
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}