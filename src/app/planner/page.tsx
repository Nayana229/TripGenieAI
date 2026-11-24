'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthModal } from '@/src/components/ClientShell';
import { ItineraryWorkspace } from '@/src/components/ItineraryWorkspace';
import { TripPlannerForm } from '@/src/components/TripPlannerForm';
import type { ItineraryData, SavedTrip, TripInput } from '@/src/types/travel';

function PlannerPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openAuthModal } = useAuthModal();
  const prefillDestination = searchParams.get('destination') || '';

  const [tripInput, setTripInput] = useState<TripInput | null>(null);
  const [itinerary, setItinerary] = useState<ItineraryData | null>(null);
  const [savedTrip, setSavedTrip] = useState<SavedTrip | null>(null);

  if (tripInput && itinerary) {
    return (
      <ItineraryWorkspace
        tripInput={tripInput}
        itinerary={itinerary}
        savedTrip={savedTrip}
        onItineraryUpdated={(next) => {
          setItinerary(next);
          if (savedTrip) {
            setSavedTrip({ ...savedTrip, itinerary: next });
          }
        }}
        onTripSaved={(saved) => {
          setSavedTrip(saved);
          router.replace(`/trips/${saved.id}`);
        }}
        onBack={() => {
          setTripInput(null);
          setItinerary(null);
          setSavedTrip(null);
        }}
        onRequestAuth={() =>
          openAuthModal(
            'Sign in with Google to save this itinerary to your personal My Trips dashboard.'
          )
        }
      />
    );
  }

  return (
    <TripPlannerForm
      initialDestination={prefillDestination}
      onItineraryGenerated={(input, generated) => {
        setTripInput(input);
        setItinerary(generated);
        setSavedTrip(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
    />
  );
}

export default function PlannerPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 text-sm text-slate-500">
          Loading Trip Planner...
        </div>
      }
    >
      <PlannerPageContent />
    </Suspense>
  );
}
