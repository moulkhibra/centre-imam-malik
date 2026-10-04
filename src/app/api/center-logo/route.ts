import '@/lib/utils/server-only';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/permissions';
import { can } from '@/lib/auth/permissions';
import { prisma } from '@/lib/db/client';
import { CENTER_SETTING_KEYS } from '@/lib/validation/settings';
import { readUploadedLogo } from '@/lib/storage/uploads';

/**
 * Serves the uploaded centre logo to signed-in users who may see the settings.
 *
 * The file lives outside `public/` precisely so that this route is the only way
 * to reach it. `<img>` requests carry the session cookie like any other request,
 * so the browser needs nothing special to display it.
 *
 * Status codes are deliberate: `401` when nobody is signed in and `403` when the
 * reader may not see the settings, so the endpoint cannot be used to tell a
 * centre apart from a session that simply does not exist.
 */

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });
  if (!can(user, 'settings.view')) return new NextResponse('Forbidden', { status: 403 });

  // Scoped to the reader's own centre: the stored name is looked up through
  // `centerId`, never taken from the request.
  const setting = await prisma.centerSetting.findUnique({
    where: { centerId_key: { centerId: user.centerId, key: CENTER_SETTING_KEYS.logoFile } },
    select: { value: true },
  });
  const storedName = setting?.value ?? '';
  if (!storedName) return new NextResponse('Not found', { status: 404 });

  const file = await readUploadedLogo(storedName);
  if (!file) return new NextResponse('Not found', { status: 404 });

  return new NextResponse(new Uint8Array(file.bytes), {
    status: 200,
    headers: {
      'Content-Type': file.contentType,
      'Content-Length': String(file.bytes.byteLength),
      // The URL never changes when the logo does, so the browser has to ask
      // again: a cached copy would keep showing the previous logo.
      'Cache-Control': 'private, no-cache',
      // The response is an image whatever the extension says.
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  });
}