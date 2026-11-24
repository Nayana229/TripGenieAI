'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Calendar, MapPin, Search, X } from 'lucide-react';
import { DESTINATION_GUIDES } from '../data/destinations';
import type { DestinationGuide } from '../types/travel';
import { DestinationImage } from './DestinationImage';

interface DestinationExplorerProps {
  initialSelected?: DestinationGuide | null;
  onPlanDestination: (destinationName: string) => void;
}

const CATEGORIES = ['All', 'Coastal', 'Cultural', 'Alpine', 'Oasis', 'Wilderness'] as const;

export function DestinationExplorer({
  initialSelected,
  onPlanDestination,
}: DestinationExplorerProps) {
  const [guides, setGuides] = useState<DestinationGuide[]>(DESTINATION_GUIDES);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [query, setQuery] = useState('');
  const [selectedGuide, setSelectedGuide] = useState<DestinationGuide | null>(
    initialSelected ?? null
  );

  useEffect(() => {
    if (initialSelected) {
      setSelectedGuide(initialSelected);
    }
  }, [initialSelected]);

  useEffect(() => {
    let active = true;
    fetch('/api/destinations')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { destinations?: DestinationGuide[] } | null) => {
        if (active && data?.destinations && data.destinations.length > 0) {
          setGuides(data.destinations);
        }
      })
      .catch(() => {
        // Fallback to static curated catalog already initialized
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = guides.filter((g) => {
    const matchesCategory = category === 'All' || g.category === category;
    const q = query.trim().toLowerCase();
    const matchesSearch =
      !q ||
      g.name.toLowerCase().includes(q) ||
      g.country.toLowerCase().includes(q) ||
      g.summary.toLowerCase().includes(q) ||
      g.popularAttractions.some((a) => a.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="max-w-2xl mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold font-display tracking-tight text-[#0B1D3A]">
          Destination Explorer
        </h1>
        <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed">
          Browse curated destination briefs, seasonal travel windows, and highlight landmarks.
          Select any destination to launch a personalized itinerary.
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-10">
        <div
          className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit"
          role="tablist"
          aria-label="Filter destinations by terrain"
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={category === cat}
              onClick={() => setCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                category === cat
                  ? 'bg-white text-[#0B1D3A] shadow-xs'
                  : 'text-slate-600 hover:text-[#0B1D3A]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by city, country, or attraction..."
            aria-label="Filter destinations"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-[#0B1D3A] placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <p className="text-base font-semibold text-[#0B1D3A]">
            No curated destinations match "{query}"
          </p>
          <p className="mt-1.5 text-sm text-slate-600">
            You can still plan a custom trip to any destination worldwide using our AI Trip Planner.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setCategory('All');
              }}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear Filters
            </button>
            {query.trim() && (
              <button
                type="button"
                onClick={() => onPlanDestination(query.trim())}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B1D3A] text-white text-sm font-medium hover:bg-[#14305E]"
              >
                Plan trip to {query.trim()}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((guide) => (
            <article
              key={guide.id}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col"
            >
              <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                <DestinationImage
                  src={guide.imageUrl}
                  alt={`${guide.name}, ${guide.country}`}
                  label={guide.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="p-6 flex-1 flex flex-col">
                <div className="text-xs text-slate-500 mb-1.5">
                  {guide.region} · {guide.recommendedDays}
                </div>
                <h2 className="text-xl font-bold font-display text-[#0B1D3A]">
                  {guide.name}, {guide.country}
                </h2>
                <p className="mt-2.5 text-sm text-slate-600 leading-relaxed">{guide.summary}</p>

                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs font-semibold text-[#0B1D3A] mb-2">Popular Attractions</p>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    {guide.popularAttractions.slice(0, 3).map((attr) => (
                      <li key={attr} className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                        <span>{attr}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedGuide(guide)}
                    className="text-sm font-medium text-slate-700 hover:text-[#0B1D3A]"
                  >
                    Read Full Brief
                  </button>
                  <button
                    type="button"
                    onClick={() => onPlanDestination(`${guide.name}, ${guide.country}`)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B1D3A] text-white text-xs sm:text-sm font-medium hover:bg-[#14305E] transition-colors whitespace-nowrap"
                  >
                    Plan Trip
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Detail Inspection Modal */}
      {selectedGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1D3A]/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guide-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="relative h-64 bg-slate-100">
              <DestinationImage
                src={selectedGuide.imageUrl}
                alt={selectedGuide.name}
                label={selectedGuide.name}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setSelectedGuide(null)}
                aria-label="Close destination brief"
                className="absolute top-4 right-4 p-2 rounded-full bg-white/90 text-[#0B1D3A] hover:bg-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 sm:p-8">
              <div className="text-xs text-slate-500 mb-1.5">
                {selectedGuide.region} · {selectedGuide.category}
              </div>
              <h2 id="guide-modal-title" className="text-2xl font-bold font-display text-[#0B1D3A]">
                {selectedGuide.name}, {selectedGuide.country}
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
                {selectedGuide.summary}
              </p>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#F8FAFC] border border-slate-200">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0B1D3A]">
                    <Calendar className="w-3.5 h-3.5 text-sky-600" />
                    <span>Typical Seasonal Window</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{selectedGuide.idealWindow}</p>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#0B1D3A]">Best Suited Styles</div>
                  <p className="mt-1 text-sm text-slate-600">
                    {selectedGuide.personalities.join(' · ')}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold text-[#0B1D3A] mb-2.5">
                  Notable Attractions & Areas
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-700">
                  {selectedGuide.popularAttractions.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 p-4 rounded-xl bg-sky-50 border border-sky-200 text-sm text-[#0B1D3A]">
                <span className="font-semibold">Planning Note: </span>
                {selectedGuide.planningNotes}
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedGuide(null)}
                  className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const dest = `${selectedGuide.name}, ${selectedGuide.country}`;
                    setSelectedGuide(null);
                    onPlanDestination(dest);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition-colors"
                >
                  Plan Trip to {selectedGuide.name}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
