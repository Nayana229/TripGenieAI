'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, Calendar, Compass, Loader2, Users, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  ACCOMMODATION_OPTIONS,
  BLUEPRINT_LIMITS,
  PREFERENCE_OPTIONS,
  SUPPORTED_CURRENCIES,
  TRAVEL_PERSONALITIES,
  type CurrencyCode,
  type ItineraryData,
  type TravelPersonality,
  type TripInput,
} from '../types/travel';

interface TripPlannerFormProps {
  initialDestination?: string;
  onItineraryGenerated: (input: TripInput, itinerary: ItineraryData) => void;
}

function getDefaultDates(): { startDate: string; endDate: string } {
  const start = new Date();
  start.setDate(start.getDate() + 14);
  const end = new Date(start);
  end.setDate(start.getDate() + 4);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export function TripPlannerForm({
  initialDestination = '',
  onItineraryGenerated,
}: TripPlannerFormProps) {
  const { preferredCurrency } = useAuth();
  const defaults = getDefaultDates();

  const [startLocation, setStartLocation] = useState('San Francisco, USA');
  const [destination, setDestination] = useState(initialDestination || 'Kyoto, Japan');
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [travellers, setTravellers] = useState(2);
  const [totalBudget, setTotalBudget] = useState(3200);
  const [currency, setCurrency] = useState<CurrencyCode>(preferredCurrency || 'USD');
  const [personality, setPersonality] = useState<TravelPersonality>('Food');
  const [accommodation, setAccommodation] = useState<string>(ACCOMMODATION_OPTIONS[0]);
  const [preferences, setPreferences] = useState<string[]>([
    'Cultural Immersion',
    'Local Cuisine & Markets',
  ]);

  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (initialDestination) {
      setDestination(initialDestination);
    }
  }, [initialDestination]);

  useEffect(() => {
    setCurrency(preferredCurrency);
  }, [preferredCurrency]);

  function togglePreference(pref: string) {
    setPreferences((prev) => {
      if (prev.includes(pref)) {
        return prev.filter((p) => p !== pref);
      }
      if (prev.length >= BLUEPRINT_LIMITS.PREFERENCES_MAX_ITEMS) {
        return prev;
      }
      return [...prev, pref];
    });
  }

  function validateForm(): string | null {
    if (startLocation.trim().length < BLUEPRINT_LIMITS.LOCATION_MIN) {
      return 'Please enter a valid starting location (at least 2 characters).';
    }
    if (destination.trim().length < BLUEPRINT_LIMITS.LOCATION_MIN) {
      return 'Please enter a valid destination (at least 2 characters).';
    }
    if (!startDate || !endDate) {
      return 'Please select both start and end travel dates.';
    }
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (Number.isNaN(diffDays) || diffDays < 1) {
      return 'End date must be on or after the start date.';
    }
    if (diffDays > BLUEPRINT_LIMITS.DAYS_MAX) {
      return `Please select a trip duration of up to ${BLUEPRINT_LIMITS.DAYS_MAX} days per itinerary.`;
    }
    if (
      !Number.isFinite(travellers) ||
      travellers < BLUEPRINT_LIMITS.TRAVELLERS_MIN ||
      travellers > BLUEPRINT_LIMITS.TRAVELLERS_MAX
    ) {
      return `Number of travellers must be between ${BLUEPRINT_LIMITS.TRAVELLERS_MIN} and ${BLUEPRINT_LIMITS.TRAVELLERS_MAX}.`;
    }
    if (!Number.isFinite(totalBudget) || totalBudget <= 0) {
      return 'Total budget must be greater than zero.';
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);
    setSubmitError(null);

    const validationMsg = validateForm();
    if (validationMsg) {
      setFieldError(validationMsg);
      return;
    }

    const payload: TripInput = {
      startLocation: startLocation.trim().slice(0, BLUEPRINT_LIMITS.LOCATION_MAX),
      destination: destination.trim().slice(0, BLUEPRINT_LIMITS.LOCATION_MAX),
      startDate,
      endDate,
      travellers: Math.round(travellers),
      totalBudget: Number(totalBudget),
      currency,
      personality,
      accommodation,
      preferences,
    };

    setIsGenerating(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 25_000);
    try {
      const res = await fetch('/api/trips/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const rawText = await res.text();
      let data: {
        itinerary?: ItineraryData;
        error?: string;
        details?: Array<{ message: string }>;
      } = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText) as typeof data;
        } catch {
          if (res.status === 504) {
            throw new Error(
              'Itinerary generation timed out on the server (504). Please try again—or select fewer days if planning a long trip.'
            );
          }
          if (res.status === 502 || res.status === 503) {
            throw new Error(
              'The AI travel service is temporarily busy. Please try again in a few moments.'
            );
          }
          throw new Error(`Server returned an unexpected response (${res.status}).`);
        }
      }

      if (!res.ok || !data.itinerary) {
        const detailMsg = data.details?.[0]?.message;
        throw new Error(detailMsg || data.error || 'Failed to generate itinerary.');
      }

      onItineraryGenerated(payload, data.itinerary);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setSubmitError(
          'The request took longer than expected and timed out. Please try again.'
        );
      } else {
        setSubmitError(
          err instanceof Error ? err.message : 'Unable to generate itinerary right now.'
        );
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsGenerating(false);
    }
  }

  const startMs = new Date(`${startDate}T00:00:00Z`).getTime();
  const endMs = new Date(`${endDate}T00:00:00Z`).getTime();
  const computedDays =
    !Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs >= startMs
      ? Math.floor((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1
      : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="mb-8">
        <p className="text-xs font-medium text-sky-700 mb-2">AI Trip Architect</p>
        <h1 className="text-3xl sm:text-4xl font-bold font-display tracking-tight text-[#0B1D3A]">
          Plan Your Personalized Itinerary
        </h1>
        <p className="mt-2.5 text-sm sm:text-base text-slate-600 max-w-2xl">
          Share your origin, destination, dates, group size, and target budget. TripGenie AI builds
          a structured day-by-day plan and checks whether your budget is realistic.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-8"
      >
        {(fieldError || submitError) && (
          <div
            role="alert"
            className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800"
          >
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to proceed</p>
              <p className="mt-0.5">{fieldError || submitError}</p>
            </div>
          </div>
        )}

        {/* Route & Dates */}
        <section className="space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold font-display text-[#0B1D3A]">
              01. Route & Schedule
            </h2>
            {computedDays > 0 && (
              <span className="font-mono text-xs text-slate-600 tabular-nums">
                {computedDays} {computedDays === 1 ? 'Day' : 'Days'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label
                htmlFor="start-location"
                className="block text-sm font-medium text-[#0B1D3A] mb-1.5"
              >
                Starting Location
              </label>
              <input
                id="start-location"
                type="text"
                required
                maxLength={BLUEPRINT_LIMITS.LOCATION_MAX}
                value={startLocation}
                onChange={(e) => setStartLocation(e.target.value)}
                placeholder="e.g., London, UK"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-[#0B1D3A] focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label
                htmlFor="destination"
                className="block text-sm font-medium text-[#0B1D3A] mb-1.5"
              >
                Destination
              </label>
              <input
                id="destination"
                type="text"
                required
                maxLength={BLUEPRINT_LIMITS.LOCATION_MAX}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g., Kyoto, Japan"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-[#0B1D3A] focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label
                htmlFor="start-date"
                className="block text-sm font-medium text-[#0B1D3A] mb-1.5"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  Travel Start Date
                </span>
              </label>
              <input
                id="start-date"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-[#0B1D3A] tabular-nums focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label
                htmlFor="end-date"
                className="block text-sm font-medium text-[#0B1D3A] mb-1.5"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  Travel End Date
                </span>
              </label>
              <input
                id="end-date"
                type="date"
                required
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-[#0B1D3A] tabular-nums focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </section>

        {/* Travellers & Budget */}
        <section className="space-y-5">
          <h2 className="text-base font-bold font-display text-[#0B1D3A] border-b border-slate-100 pb-3">
            02. Group Size & Total Budget
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label
                htmlFor="travellers"
                className="block text-sm font-medium text-[#0B1D3A] mb-1.5"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-slate-400" />
                  Travellers
                </span>
              </label>
              <input
                id="travellers"
                type="number"
                min={BLUEPRINT_LIMITS.TRAVELLERS_MIN}
                max={BLUEPRINT_LIMITS.TRAVELLERS_MAX}
                required
                value={travellers}
                onChange={(e) => setTravellers(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-[#0B1D3A] tabular-nums focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label
                htmlFor="total-budget"
                className="block text-sm font-medium text-[#0B1D3A] mb-1.5"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-slate-400" />
                  Total Budget
                </span>
              </label>
              <input
                id="total-budget"
                type="number"
                min={1}
                step="any"
                required
                value={totalBudget}
                onChange={(e) => setTotalBudget(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-[#0B1D3A] tabular-nums focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label
                htmlFor="currency"
                className="block text-sm font-medium text-[#0B1D3A] mb-1.5"
              >
                Currency
              </label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-[#0B1D3A] focus:outline-none focus:border-sky-500"
              >
                {SUPPORTED_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Personality & Accommodation */}
        <section className="space-y-5">
          <h2 className="text-base font-bold font-display text-[#0B1D3A] border-b border-slate-100 pb-3">
            03. Travel Style & Accommodation
          </h2>

          <div>
            <span className="block text-sm font-medium text-[#0B1D3A] mb-2.5">
              Travel Personality
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {TRAVEL_PERSONALITIES.map((item) => {
                const selected = personality === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPersonality(item)}
                    className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors whitespace-nowrap ${
                      selected
                        ? 'bg-[#0B1D3A] border-[#0B1D3A] text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-sky-400 hover:text-[#0B1D3A]'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="accommodation"
              className="block text-sm font-medium text-[#0B1D3A] mb-1.5"
            >
              Accommodation Preference
            </label>
            <select
              id="accommodation"
              value={accommodation}
              onChange={(e) => setAccommodation(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-[#0B1D3A] focus:outline-none focus:border-sky-500"
            >
              {ACCOMMODATION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Preferences */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold font-display text-[#0B1D3A]">
              04. Travel Preferences
            </h2>
            <span className="text-xs text-slate-500 tabular-nums">
              {preferences.length}/{BLUEPRINT_LIMITS.PREFERENCES_MAX_ITEMS} selected
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {PREFERENCE_OPTIONS.map((pref) => {
              const active = preferences.includes(pref);
              return (
                <button
                  key={pref}
                  type="button"
                  onClick={() => togglePreference(pref)}
                  className={`px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-sky-50 border-sky-500 text-sky-900'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-[#0B1D3A]'
                  }`}
                >
                  {pref}
                </button>
              );
            })}
          </div>
        </section>

        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xs text-slate-500 max-w-md">
            Itineraries and costs are AI-estimated planning models, not live flight fares, weather,
            or hotel inventory.
          </p>
          <button
            type="submit"
            disabled={isGenerating}
            className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition-colors disabled:opacity-70 whitespace-nowrap shrink-0"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Building Your Itinerary...
              </>
            ) : (
              <>
                <Compass className="w-4 h-4" />
                Generate Itinerary
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
