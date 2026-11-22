import { PwaRegistration } from '@/components/shared/pwa';
import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'AECS Attend', template: '%s · AECS Attend' },
  description: 'Attendance, organized. Abroad Education Consultancy Services, Nepal.',
  applicationName: 'AECS Attend',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'AECS Attend' },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#072B62' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
