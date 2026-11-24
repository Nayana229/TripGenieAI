'use client';

import { useRouter } from 'next/navigation';
import { HomeView } from '@/src/components/HomeView';
import type { DestinationGuide } from '@/src/types/travel';

export default function HomePage() {
  const router = useRouter();

  return (
    <HomeView
      onStartPlanning={(prefillDestination) => {
        if (prefillDestination) {
          router.push(`/planner?destination=${encodeURIComponent(prefillDestination)}`);
        } else {
          router.push('/planner');
        }
      }}
      onSelectDestination={(guide: DestinationGuide) => {
        router.push(`/explore?destination=${encodeURIComponent(guide.id)}`);
      }}
      onOpenExplore={() => router.push('/explore')}
    />
  );
}
