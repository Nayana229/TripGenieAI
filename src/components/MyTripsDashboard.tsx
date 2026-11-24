'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Compass,
  Edit3,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { deleteSavedTrip, subscribeUserTrips, updateSavedTrip } from '../lib/tripStore';
import {
  BLUEPRINT_LIMITS,
  SUPPORTED_CURRENCIES,
  TRIP_STATUSES,
  type CurrencyCode,
  type SavedTrip,
  type TripStatus,
} from '../types/travel';
import { formatMoney } from './SmartBudgetPanel';

interface MyTripsDashboardProps {
  onViewTrip: (trip: SavedTrip) => void;
  onCreateNew: () => void;
  onOpenAuth: () => void;
}

export function MyTripsDashboard({
  onViewTrip,
  onCreateNew,
  onOpenAuth,
}: MyTripsDashboardProps) {
  const { user, authReady } = useAuth();
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'all' | TripStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [editingTrip, setEditingTrip] = useState<SavedTrip | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTravellers, setEditTravellers] = useState(1);
  const [editBudget, setEditBudget] = useState(1000);
  const [editCurrency, setEditCurrency] = useState<CurrencyCode>('USD');
  const [editStatus, setEditStatus] = useState<TripStatus>('upcoming');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingTrip, setDeletingTrip] = useState<SavedTrip | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setTrips([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    const unsub = subscribeUserTrips(
      user.uid,
      (list) => {
        setTrips(list);
        setLoading(false);
      },
      (err) => {
        setLoadError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [authReady, user]);

  function openEditModal(trip: SavedTrip) {
    setEditingTrip(trip);
    setEditTitle(trip.title);
    setEditTravellers(trip.travellers);
    setEditBudget(trip.totalBudget);
    setEditCurrency(trip.currency);
    setEditStatus(trip.status);
    setEditNotes(trip.notes || '');
    setEditError(null);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTrip) return;

    if (editTitle.trim().length < BLUEPRINT_LIMITS.TITLE_MIN) {
      setEditError('Trip title must be at least 2 characters.');
      return;
    }
    if (editBudget <= 0) {
      setEditError('Budget must be greater than zero.');
      return;
    }

    setSavingEdit(true);
    setEditError(null);
    try {
      await updateSavedTrip(editingTrip.id, editingTrip.status, {
        title: editTitle.trim(),
        travellers: editTravellers,
        totalBudget: editBudget,
        currency: editCurrency,
        status: editStatus,
        notes: editNotes.trim(),
      });
      setEditingTrip(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to save changes.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingTrip || !user) return;
    setDeletingInProgress(true);
    try {
      await deleteSavedTrip(deletingTrip.id, user.uid);
      setDeletingTrip(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to delete trip.');
      setDeletingTrip(null);
    } finally {
      setDeletingInProgress(false);
    }
  }

  if (!authReady || (user && loading)) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <div className="h-9 w-56 bg-slate-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-24 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((n) => (
            <div key={n} className="h-52 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12">
          <Compass className="w-10 h-10 text-sky-600 mx-auto mb-4" />
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#0B1D3A]">
            Your Personal Travel Dashboard
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-md mx-auto leading-relaxed">
            Sign in with Google to save generated itineraries, edit trip budgets, track upcoming
            departures, and revisit past journeys.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-6 py-3 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#14305E] transition-colors"
            >
              Sign in with Google
            </button>
            <button
              type="button"
              onClick={onCreateNew}
              className="px-6 py-3 rounded-xl border border-slate-200 text-sm font-medium text-[#0B1D3A] hover:bg-slate-50 transition-colors"
            >
              Preview Trip Planner
            </button>
          </div>
        </div>
      </div>
    );
  }

  const upcomingCount = trips.filter((t) => t.status === 'upcoming').length;
  const completedCount = trips.filter((t) => t.status === 'completed').length;
  const primaryCurrency: CurrencyCode = trips[0]?.currency || 'USD';
  const sameCurrencyTotal = trips
    .filter((t) => t.currency === primaryCurrency)
    .reduce((acc, t) => acc + (t.totalBudget || 0), 0);

  const filteredTrips = trips.filter((t) => {
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.destination.toLowerCase().includes(q) ||
      t.startLocation.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-[#0B1D3A]">
            My Trips Dashboard
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Manage saved itineraries, review budget allocations, and adjust upcoming plans.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateNew}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Plan New Trip
        </button>
      </div>

      {loadError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {loadError}
        </div>
      )}

      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-xs text-slate-500">Saved Trips</p>
          <p className="mt-2 text-2xl font-bold font-mono text-[#0B1D3A] tabular-nums">
            {trips.length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-xs text-slate-500">Upcoming Trips</p>
          <p className="mt-2 text-2xl font-bold font-mono text-sky-700 tabular-nums">
            {upcomingCount}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-xs text-slate-500">Previous Itineraries</p>
          <p className="mt-2 text-2xl font-bold font-mono text-[#0B1D3A] tabular-nums">
            {completedCount}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-xs text-slate-500">Budget Total ({primaryCurrency})</p>
          <p className="mt-2 text-2xl font-bold font-mono text-[#0B1D3A] tabular-nums">
            {formatMoney(sameCurrencyTotal, primaryCurrency)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div
          className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit"
          role="tablist"
        >
          {(['all', ...TRIP_STATUSES] as const).map((status) => (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={statusFilter === status}
              onClick={() => setStatusFilter(status)}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium capitalize transition-colors ${
                statusFilter === status
                  ? 'bg-white text-[#0B1D3A] shadow-xs'
                  : 'text-slate-600 hover:text-[#0B1D3A]'
              }`}
            >
              {status === 'completed' ? 'Previous' : status}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved trips..."
            aria-label="Search saved trips"
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-sm text-[#0B1D3A] focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Empty or Populated Trip Grid */}
      {trips.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <h2 className="text-xl font-bold font-display text-[#0B1D3A]">No saved trips yet</h2>
          <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
            Create your first personalized itinerary to track daily schedules, estimated budgets,
            and conversational refinements here.
          </p>
          <button
            type="button"
            onClick={onCreateNew}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#14305E]"
          >
            <Plus className="w-4 h-4" />
            Plan Your First Trip
          </button>
        </div>
      ) : filteredTrips.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-600">
          No trips match the active filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredTrips.map((trip) => (
            <article
              key={trip.id}
              className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between gap-5"
            >
              <div>
                <div className="flex items-center justify-between gap-3 text-xs text-slate-500 mb-2">
                  <span className="capitalize font-medium text-sky-700">
                    {trip.status === 'completed' ? 'Previous' : trip.status}
                  </span>
                  <span className="font-mono tabular-nums">
                    {trip.itinerary.days.length} days · {trip.travellers}{' '}
                    {trip.travellers === 1 ? 'traveller' : 'travellers'}
                  </span>
                </div>
                <h2 className="text-xl font-bold font-display text-[#0B1D3A]">{trip.title}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {trip.startLocation} → {trip.destination}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600 tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {trip.startDate} to {trip.endDate}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono font-medium text-[#0B1D3A]">
                    Budget: {formatMoney(trip.totalBudget, trip.currency)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{trip.personality}</span>
                </div>

                {trip.notes && (
                  <p className="mt-3 text-xs text-slate-500 line-clamp-2">{trip.notes}</p>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(trip)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingTrip(trip)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onViewTrip(trip)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 hover:text-[#0B1D3A] whitespace-nowrap"
                >
                  Open Itinerary
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Edit Trip Modal */}
      {editingTrip && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1D3A]/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-trip-title"
        >
          <form
            onSubmit={handleSaveEdit}
            className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 id="edit-trip-title" className="text-xl font-bold font-display text-[#0B1D3A]">
                Edit Trip Details
              </h2>
              <button
                type="button"
                onClick={() => setEditingTrip(null)}
                aria-label="Close edit dialog"
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#0B1D3A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editingTrip.status === 'completed' && (
              <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-[#0B1D3A]">
                Completed trips lock budget and headcount fields. Change status to Upcoming or Draft
                first if you want to revise other fields.
              </div>
            )}

            {editError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                {editError}
              </div>
            )}

            <div className="space-y-4">
              {editingTrip.status !== 'completed' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-[#0B1D3A] mb-1">
                      Trip Title
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={BLUEPRINT_LIMITS.TITLE_MAX}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-[#0B1D3A]"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#0B1D3A] mb-1">
                        Travellers
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={editTravellers}
                        onChange={(e) => setEditTravellers(Number(e.target.value))}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#0B1D3A] mb-1">
                        Budget
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={editBudget}
                        onChange={(e) => setEditBudget(Number(e.target.value))}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#0B1D3A] mb-1">
                        Currency
                      </label>
                      <select
                        value={editCurrency}
                        onChange={(e) => setEditCurrency(e.target.value as CurrencyCode)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                      >
                        {SUPPORTED_CURRENCIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-medium text-[#0B1D3A] mb-1">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as TripStatus)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm capitalize"
                >
                  {TRIP_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s === 'completed' ? 'Previous / Completed' : s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#0B1D3A] mb-1">
                  Personal Notes
                </label>
                <textarea
                  rows={3}
                  maxLength={BLUEPRINT_LIMITS.NOTES_MAX}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Packing reminders, travel companions, or reservation notes..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-[#0B1D3A]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingTrip(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#14305E] disabled:opacity-60"
              >
                {savingEdit && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTrip && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1D3A]/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-trip-title"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h2 id="delete-trip-title" className="text-lg font-bold font-display text-[#0B1D3A]">
              Delete "{deletingTrip.title}"?
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              This permanently removes the saved itinerary and its assistant conversation history
              from your account.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deletingInProgress}
                onClick={() => setDeletingTrip(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingInProgress}
                onClick={() => void handleConfirmDelete()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
              >
                {deletingInProgress && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete Trip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
