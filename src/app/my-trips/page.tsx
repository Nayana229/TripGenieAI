'use client';

import { useRouter } from 'next/navigation';
import { useAuthModal } from '@/src/components/ClientShell';
import { MyTripsDashboard } from '@/src/components/MyTripsDashboard';
import type { SavedTrip } from '@/src/types/travel';

export default function MyTripsPage() {
  const router = useRouter();
  const { openAuthModal } = useAuthModal();

  return (
    <MyTripsDashboard
      onViewTrip={(trip: SavedTrip) => router.push(`/trips/${trip.id}`)}
      onCreateNew={() => router.push('/planner')}
      onOpenAuth={() =>
        openAuthModal('Sign in with Google to view, edit, and organize your saved itineraries.')
      }
    />
  );
}
