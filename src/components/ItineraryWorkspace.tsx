'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Check,
  Clock,
  Compass,
  Download,
  Info,
  Loader2,
  MapPin,
  Printer,
  Sun,
  Sunrise,
  Sunset,
  Utensils,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  addTripMessage,
  createSavedTrip,
  subscribeTripMessages,
  updateSavedTrip,
} from '../lib/tripStore';
import type { ChatMessage, ItineraryData, SavedTrip, TripInput } from '../types/travel';
import { ItineraryChatbot, type LocalChatMessage } from './ItineraryChatbot';
import { formatMoney, SmartBudgetPanel } from './SmartBudgetPanel';

interface ItineraryWorkspaceProps {
  tripInput: TripInput;
  itinerary: ItineraryData;
  savedTrip: SavedTrip | null;
  onItineraryUpdated: (nextItinerary: ItineraryData) => void;
  onTripSaved: (saved: SavedTrip) => void;
  onBack: () => void;
  onRequestAuth: () => void;
}

export function ItineraryWorkspace({
  tripInput,
  itinerary,
  savedTrip,
  onItineraryUpdated,
  onTripSaved,
  onBack,
  onRequestAuth,
}: ItineraryWorkspaceProps) {
  const { user, authReady } = useAuth();
  const [selectedDay, setSelectedDay] = useState<'all' | number>('all');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const [localMessages, setLocalMessages] = useState<LocalChatMessage[]>([]);
  const [firestoreMessages, setFirestoreMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!authReady || !user || !savedTrip) {
      setFirestoreMessages([]);
      return;
    }

    const unsub = subscribeTripMessages(
      savedTrip.id,
      user.uid,
      (msgs) => setFirestoreMessages(msgs),
      (err) => console.error('Failed to subscribe trip messages:', err)
    );
    return () => unsub();
  }, [authReady, user, savedTrip]);

  const activeMessages: LocalChatMessage[] = savedTrip
    ? firestoreMessages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        appliedUpdate: m.appliedUpdate,
      }))
    : localMessages;

  async function handleSaveTrip() {
    if (!user) {
      onRequestAuth();
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveSuccessMsg(null);

    try {
      const created = await createSavedTrip({
        userId: user.uid,
        input: tripInput,
        itinerary,
      });

      // Persist any pre-save chat messages into the new trip's subcollection
      if (localMessages.length > 0) {
        await Promise.all(
          localMessages.map((m) =>
            addTripMessage({
              tripId: created.id,
              userId: user.uid,
              role: m.role,
              content: m.content,
              appliedUpdate: m.appliedUpdate,
            })
          )
        );
      }

      onTripSaved(created);
      setSaveSuccessMsg('Trip saved to your My Trips dashboard.');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save trip.');
    } finally {
      setSaving(false);
    }
  }

  async function handleChatExchange(
    userText: string,
    assistantReply: string,
    updatedItinerary?: ItineraryData
  ) {
    if (updatedItinerary) {
      onItineraryUpdated(updatedItinerary);
    }

    if (savedTrip && user) {
      if (updatedItinerary) {
        await updateSavedTrip(savedTrip.id, savedTrip.status, {
          itinerary: updatedItinerary,
        });
      }
      await addTripMessage({
        tripId: savedTrip.id,
        userId: user.uid,
        role: 'user',
        content: userText,
        appliedUpdate: false,
      });
      await addTripMessage({
        tripId: savedTrip.id,
        userId: user.uid,
        role: 'assistant',
        content: assistantReply,
        appliedUpdate: Boolean(updatedItinerary),
      });
    } else {
      setLocalMessages((prev) => [
        ...prev,
        {
          id: `local_u_${Date.now()}`,
          role: 'user',
          content: userText,
          appliedUpdate: false,
        },
        {
          id: `local_a_${Date.now() + 1}`,
          role: 'assistant',
          content: assistantReply,
          appliedUpdate: Boolean(updatedItinerary),
        },
      ]);
    }
  }

  function handleExportJson() {
    const payload = {
      trip: tripInput,
      itinerary,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tripgenie-${tripInput.destination.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const visibleDays =
    selectedDay === 'all'
      ? itinerary.days
      : itinerary.days.filter((d) => d.dayNumber === selectedDay);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Top Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 mb-8">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="no-print inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#0B1D3A] mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-[#0B1D3A]">
            {savedTrip ? savedTrip.title : `${tripInput.destination} Itinerary`}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-slate-600">
            <span>From {tripInput.startLocation}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {tripInput.startDate} to {tripInput.endDate}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {tripInput.travellers} {tripInput.travellers === 1 ? 'Traveller' : 'Travellers'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{tripInput.personality}</span>
            <span aria-hidden="true">·</span>
            <span>{tripInput.accommodation}</span>
          </div>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs sm:text-sm font-medium hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs sm:text-sm font-medium hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Export JSON
          </button>
          {savedTrip ? (
            <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium whitespace-nowrap">
              <Check className="w-4 h-4" />
              Saved to My Trips
            </span>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveTrip()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#14305E] transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
              {user ? 'Save Trip' : 'Sign in to Save'}
            </button>
          )}
        </div>
      </div>

      {saveError && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {saveError}
        </div>
      )}
      {saveSuccessMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          {saveSuccessMsg}
        </div>
      )}

      {/* Main Split: Itinerary + Budget (left 2 cols) & Chatbot (right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
          {/* Overview */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 space-y-4">
            <h2 className="text-xl font-bold font-display text-[#0B1D3A]">Trip Overview</h2>
            <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
              {itinerary.overview.summary}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200">
                <p className="text-xs font-semibold text-[#0B1D3A] mb-1">Pacing & Timing Tip</p>
                <p className="text-sm text-slate-600">{itinerary.overview.bestTimeTip}</p>
              </div>
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200">
                <p className="text-xs font-semibold text-[#0B1D3A] mb-1">Local Transit Guidance</p>
                <p className="text-sm text-slate-600">{itinerary.overview.localTransportNote}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 pt-2 text-xs text-slate-500">
              <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <span>{itinerary.overview.estimationDisclaimer}</span>
            </div>
          </section>

          {/* Smart Budget Planner */}
          <SmartBudgetPanel
            budgetAnalysis={itinerary.budgetAnalysis}
            currency={tripInput.currency}
          />

          {/* Day-wise Itinerary */}
          <section className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-xl font-bold font-display text-[#0B1D3A]">
                Day-by-Day Itinerary
              </h2>
              <div
                className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit"
                role="tablist"
                aria-label="Filter itinerary days"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedDay === 'all'}
                  onClick={() => setSelectedDay('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedDay === 'all'
                      ? 'bg-white text-[#0B1D3A] shadow-xs'
                      : 'text-slate-600 hover:text-[#0B1D3A]'
                  }`}
                >
                  All Days
                </button>
                {itinerary.days.map((d) => (
                  <button
                    key={d.dayNumber}
                    type="button"
                    role="tab"
                    aria-selected={selectedDay === d.dayNumber}
                    onClick={() => setSelectedDay(d.dayNumber)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium tabular-nums transition-colors ${
                      selectedDay === d.dayNumber
                        ? 'bg-white text-[#0B1D3A] shadow-xs'
                        : 'text-slate-600 hover:text-[#0B1D3A]'
                    }`}
                  >
                    Day {d.dayNumber}
                  </button>
                ))}
              </div>
            </div>

            {visibleDays.map((day) => (
              <article
                key={day.dayNumber}
                className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div>
                    <div className="text-xs font-mono text-sky-700 tabular-nums">
                      Day {day.dayNumber} · {day.date}
                    </div>
                    <h3 className="mt-1 text-lg sm:text-xl font-bold font-display text-[#0B1D3A]">
                      {day.theme}
                    </h3>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-xs text-slate-500 block">Est. Day Expenses</span>
                    <span className="font-mono text-base font-bold text-[#0B1D3A] tabular-nums">
                      ~{formatMoney(day.estimatedDayExpense, tripInput.currency)}
                    </span>
                  </div>
                </div>

                {/* Morning / Afternoon / Evening */}
                <div className="space-y-4">
                  {[
                    { label: 'Morning', icon: Sunrise, slot: day.morning },
                    { label: 'Afternoon', icon: Sun, slot: day.afternoon },
                    { label: 'Evening', icon: Sunset, slot: day.evening },
                  ].map(({ label, icon: Icon, slot }) => (
                    <div
                      key={label}
                      className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200/80 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-sky-800">
                          <Icon className="w-4 h-4 text-sky-600" />
                          <span>{label}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {slot.duration}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-medium text-[#0B1D3A]">
                            ~{formatMoney(slot.estimatedCost, tripInput.currency)}
                          </span>
                        </div>
                      </div>
                      <h4 className="text-base font-bold font-display text-[#0B1D3A]">
                        {slot.title}
                      </h4>
                      <p className="text-sm text-slate-600 leading-relaxed">{slot.description}</p>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{slot.location}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Attractions & Food */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-100">
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-[#0B1D3A] mb-3">
                      <Compass className="w-4 h-4 text-sky-600" />
                      Recommended Attractions
                    </h4>
                    <ul className="space-y-1.5 text-sm text-slate-600 list-disc pl-5">
                      {day.recommendedAttractions.map((attr) => (
                        <li key={attr}>{attr}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-[#0B1D3A] mb-3">
                      <Utensils className="w-4 h-4 text-sky-600" />
                      Food Recommendations
                    </h4>
                    <div className="space-y-3">
                      {day.foodRecommendations.map((food) => (
                        <div key={food.name} className="text-sm">
                          <div className="font-semibold text-[#0B1D3A]">
                            {food.name}{' '}
                            <span className="font-normal text-xs text-slate-500">
                              · {food.cuisine} · {food.priceNote}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">
                            Try: {food.dishToTry}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Travel Suggestions */}
                {day.travelSuggestions && day.travelSuggestions.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-semibold text-[#0B1D3A] mb-2">
                      Travel Suggestions for Day {day.dayNumber}
                    </h4>
                    <ul className="space-y-1 text-xs sm:text-sm text-slate-600 list-disc pl-5">
                      {day.travelSuggestions.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            ))}
          </section>
        </div>

        {/* Conversational AI Chatbot */}
        <div className="lg:col-span-1">
          <ItineraryChatbot
            tripInput={tripInput}
            itinerary={itinerary}
            messages={activeMessages}
            onSendMessage={handleChatExchange}
          />
        </div>
      </div>
    </div>
  );
}
