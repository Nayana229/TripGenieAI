'use client';

import { useRouter } from 'next/navigation';
import { AboutView } from '@/src/components/AboutView';

export default function AboutPage() {
  const router = useRouter();
  return <AboutView onStartPlanning={() => router.push('/planner')} />;
}
