'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DestinationExplorer } from '@/src/components/DestinationExplorer';
import { DESTINATION_GUIDES } from '@/src/data/destinations';

function ExplorePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const destId = searchParams.get('destination');
  const initialSelected = destId
    ? DESTINATION_GUIDES.find((g) => g.id === destId) || null
    : null;

  return (
    <DestinationExplorer
      initialSelected={initialSelected}
      onPlanDestination={(destinationName) => {
        router.push(`/planner?destination=${encodeURIComponent(destinationName)}`);
      }}
    />
  );
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 text-sm text-slate-500">
          Loading destination guides...
        </div>
      }
    >
      <ExplorePageContent />
    </Suspense>
  );
}
