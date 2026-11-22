import { PwaRegistration } from '@/components/shared/pwa';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';
const manrope = Manrope({ subsets: ['latin'], display: 'swap', variable: '--font-manrope' });
export const metadata: Metadata = {
  title: { default: 'AECS Attend', template: '%s · AECS Attend' },
  description: 'Attendance, organized. Abroad Education Consultancy Services, Nepal.',
  applicationName: 'AECS Attend',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'AECS Attend' },
  icons: {
    icon: [
      { url: '/brand/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/brand/icon-180.png',
  },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#3854ac' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
