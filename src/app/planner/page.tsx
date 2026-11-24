'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthModal } from '@/src/components/ClientShell';
import { ItineraryWorkspace } from '@/src/components/ItineraryWorkspace';
import { TripPlannerForm } from '@/src/components/TripPlannerForm';
import type { ItineraryData, SavedTrip, TripInput } from '@/src/types/travel';

const PREVIEW_STORAGE_KEY = 'tripgenie_active_preview_v1';

function PlannerPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openAuthModal } = useAuthModal();
  const prefillDestination = searchParams.get('destination') || '';

  const [tripInput, setTripInput] = useState<TripInput | null>(null);
  const [itinerary, setItinerary] = useState<ItineraryData | null>(null);
  const [savedTrip, setSavedTrip] = useState<SavedTrip | null>(null);

  useEffect(() => {
    if (prefillDestination) return;
    try {
      const raw = sessionStorage.getItem(PREVIEW_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { input?: TripInput; itinerary?: ItineraryData };
      if (parsed.input && parsed.itinerary) {
        setTripInput(parsed.input);
        setItinerary(parsed.itinerary);
      }
    } catch {
      // Ignore corrupt sessionStorage state
    }
  }, [prefillDestination]);

  function persistPreview(input: TripInput | null, data: ItineraryData | null) {
    try {
      if (input && data) {
        sessionStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify({ input, itinerary: data }));
      } else {
        sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
      }
    } catch {
      // Ignore storage quota errors
    }
  }

  if (tripInput && itinerary) {
    return (
      <ItineraryWorkspace
        tripInput={tripInput}
        itinerary={itinerary}
        savedTrip={savedTrip}
        onItineraryUpdated={(next) => {
          setItinerary(next);
          persistPreview(tripInput, next);
          if (savedTrip) {
            setSavedTrip({ ...savedTrip, itinerary: next });
          }
        }}
        onTripSaved={(saved) => {
          setSavedTrip(saved);
          persistPreview(null, null);
          router.replace(`/trips/${saved.id}`);
        }}
        onBack={() => {
          setTripInput(null);
          setItinerary(null);
          setSavedTrip(null);
          persistPreview(null, null);
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
        persistPreview(input, generated);
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
