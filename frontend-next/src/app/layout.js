import { Space_Mono, DM_Sans } from 'next/font/google';
import './globals.css';

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-mono-next',
  display: 'swap',
});

const dmSans = DM_Sans({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-sans-next',
  display: 'swap',
});

export const metadata = {
  title: 'Smart Energy Tracker',
  description: 'Real-time smart appliance energy monitoring and control dashboard.',
  keywords: ['energy tracker', 'smart home', 'IoT', 'appliance monitor'],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${spaceMono.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
