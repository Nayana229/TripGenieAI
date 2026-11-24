'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Compass } from 'lucide-react';
import { useAuthModal } from '@/src/components/ClientShell';
import { ItineraryWorkspace } from '@/src/components/ItineraryWorkspace';
import { useAuth } from '@/src/contexts/AuthContext';
import { getSavedTripById } from '@/src/lib/tripStore';
import type { SavedTrip, TripInput } from '@/src/types/travel';

export default function SavedTripDetailPage() {
  const params = useParams<{ tripId: string }>();
  const router = useRouter();
  const { user, authReady } = useAuth();
  const { openAuthModal } = useAuthModal();

  const [trip, setTrip] = useState<SavedTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tripId = params?.tripId;

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setLoading(false);
      return;
    }
    if (!tripId) {
      setError('Invalid trip identifier.');
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    getSavedTripById(tripId)
      .then((found) => {
        if (!active) return;
        if (!found) {
          setError('Trip not found or you do not have permission to view it.');
        } else {
          setTrip(found);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load trip.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authReady, user, tripId]);

  if (!authReady || (user && loading)) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <div className="h-8 w-64 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-44 bg-white border border-slate-200 rounded-2xl animate-pulse" />
        <div className="h-72 bg-white border border-slate-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-10">
          <Compass className="w-10 h-10 text-sky-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold font-display text-[#0B1D3A]">
            Sign in to view this saved trip
          </h1>
          <p className="mt-2.5 text-sm text-slate-600">
            Saved itineraries are private to the account that created them.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() =>
                openAuthModal('Sign in with Google to view this saved itinerary.')
              }
              className="px-5 py-2.5 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#14305E]"
            >
              Sign in with Google
            </button>
            <Link
              href="/my-trips"
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-[#0B1D3A] hover:bg-slate-50"
            >
              My Trips
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 space-y-4">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
          <h1 className="text-xl font-bold font-display text-[#0B1D3A]">
            Unable to open itinerary
          </h1>
          <p className="text-sm text-slate-600">{error || 'This itinerary could not be found.'}</p>
          <Link
            href="/my-trips"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0B1D3A] text-white text-sm font-medium hover:bg-[#14305E]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to My Trips
          </Link>
        </div>
      </div>
    );
  }

  const tripInput: TripInput = {
    startLocation: trip.startLocation,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    travellers: trip.travellers,
    totalBudget: trip.totalBudget,
    currency: trip.currency,
    personality: trip.personality,
    accommodation: trip.accommodation,
    preferences: trip.preferences,
  };

  return (
    <ItineraryWorkspace
      tripInput={tripInput}
      itinerary={trip.itinerary}
      savedTrip={trip}
      onItineraryUpdated={(next) => setTrip({ ...trip, itinerary: next })}
      onTripSaved={(saved) => setTrip(saved)}
      onBack={() => router.push('/my-trips')}
      onRequestAuth={() => openAuthModal()}
    />
  );
}
