import type { Metadata, Viewport } from 'next';
import { getActiveCenter } from '@/lib/settings/center';
import { getLocaleFromCookies, dir } from '@/lib/i18n';
import './globals.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const center = await getActiveCenter();
  const title = center?.nameFr ?? 'Centre Imam Malik';
  const description = center
    ? `${center.nameFr} — Gestion des élèves, des inscriptions et de la comptabilité.`
    : 'Logiciel de gestion de centre de soutien scolaire et de formation.';

  return {
    title: { default: title, template: `%s | ${title}` },
    description,
    applicationName: title,
    robots: { index: false, follow: false },
    icons: { icon: '/favicon.svg' },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, center] = await Promise.all([getLocaleFromCookies(), getActiveCenter()]);

  const brandPrimary = center?.primaryColor ?? '#0F766E';
  const brandSecondary = center?.secondaryColor ?? '#F59E0B';

  return (
    <html
      lang={locale}
      dir={dir(locale)}
      suppressHydrationWarning
      style={
        {
          '--brand-primary': brandPrimary,
          '--brand-secondary': brandSecondary,
        } as React.CSSProperties
      }
    >
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
