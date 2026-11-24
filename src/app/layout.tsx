import type { Metadata } from 'next';
import { DM_Sans, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import { ClientShell } from '@/src/components/ClientShell';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-plus-jakarta',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-dm-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: 'TripGenie AI — Your Journey, Intelligently Planned',
  description:
    'Your Journey, Intelligently Planned. An intelligent full-stack travel planning platform with AI-generated day-wise itineraries, smart budget calibration, and conversational refinement.',
  openGraph: {
    title: 'TripGenie AI — Your Journey, Intelligently Planned',
    description:
      'Plan personalized trips based on your destination, budget, travel personality, and schedule with TripGenie AI.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-[#F8FAFC] text-[#0B1D3A] antialiased selection:bg-sky-200 selection:text-[#0B1D3A]">
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
