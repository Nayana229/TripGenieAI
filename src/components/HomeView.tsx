'use client';

import { useState } from 'react';
import { ArrowRight, Compass, Search } from 'lucide-react';
import { DESTINATION_GUIDES } from '../data/destinations';
import type { DestinationGuide } from '../types/travel';
import { DestinationImage } from './DestinationImage';

interface HomeViewProps {
  onStartPlanning: (prefillDestination?: string) => void;
  onSelectDestination: (guide: DestinationGuide) => void;
  onOpenExplore: () => void;
}

const CAPABILITIES = [
  {
    number: '01.',
    title: 'Structured Day-Wise Pacing',
    description:
      'Every morning, afternoon, and evening slot is sequenced geographically so you spend hours experiencing a place rather than backtracking across transit lines.',
    span: 'lg:col-span-2',
  },
  {
    number: '02.',
    title: 'Honest Budget Calibration',
    description:
      'Compare your target spend against estimated transportation, lodging, food, and activity ranges with clear alerts whenever a budget looks tight or unrealistic.',
    span: 'lg:col-span-1',
  },
  {
    number: '03.',
    title: 'Conversational Itinerary Editing',
    description:
      'Ask questions or request changes in plain language—swap an evening activity, shift toward local food markets, or scale down daily spend—and watch your plan update.',
    span: 'lg:col-span-1',
  },
  {
    number: '04.',
    title: 'Persistent Cloud Trip Vault',
    description:
      'Save drafts, track upcoming departures, adjust group headcount or budgets, and revisit completed itineraries anytime from your personal dashboard.',
    span: 'lg:col-span-2',
  },
];

export function HomeView({
  onStartPlanning,
  onSelectDestination,
  onOpenExplore,
}: HomeViewProps) {
  const [searchQuery, setSearchQuery] = useState('');

  function handleHeroSubmit(e: React.FormEvent) {
    e.preventDefault();
    onStartPlanning(searchQuery.trim() || undefined);
  }

  return (
    <div>
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden bg-[#08162E] text-white">
        <div className="absolute inset-0">
          <DestinationImage
            src="/images/hero_amalfi_coast_1795494747344.jpg"
            alt="Amalfi Coast cliffside village overlooking deep navy sea at golden hour"
            label="Amalfi Coast"
            className="w-full h-full object-cover object-center opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#071429]/95 via-[#0B1D3A]/80 to-[#0B1D3A]/45" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-sky-300 mb-3">
              TripGenie AI · Your Journey, Intelligently Planned.
            </p>
            <h1
              className="font-display font-bold tracking-tight text-white leading-[1.08]"
              style={{ fontSize: 'clamp(2.25rem, 4.4vw, 3.75rem)', textWrap: 'balance' }}
            >
              Where Would You Like to Go Next?
            </h1>
            <p className="mt-5 text-base sm:text-lg text-slate-200 leading-relaxed max-w-xl">
              Build tailored day-by-day travel itineraries calibrated to your budget, group size,
              travel personality, and preferred accommodation style.
            </p>

            {/* Destination Search + Primary Plan My Trip CTA */}
            <form
              onSubmit={handleHeroSubmit}
              className="mt-8 bg-white p-2 rounded-2xl shadow-lg flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-xl"
            >
              <label htmlFor="hero-destination-search" className="sr-only">
                Search destination
              </label>
              <div className="flex items-center gap-3 flex-1 px-3 py-2">
                <Search className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                  id="hero-destination-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Try Kyoto, Santorini, Swiss Alps, Marrakech..."
                  className="w-full text-sm sm:text-base text-[#0B1D3A] placeholder:text-slate-400 focus:outline-none bg-transparent"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition-colors duration-150 whitespace-nowrap shrink-0"
              >
                Plan My Trip
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-slate-300">
              <span>Popular searches:</span>
              {['Kyoto, Japan', 'Santorini, Greece', 'Patagonia, Chile'].map((place, idx) => (
                <span key={place} className="inline-flex items-center gap-4">
                  {idx > 0 && <span aria-hidden="true" className="text-slate-500">·</span>}
                  <button
                    type="button"
                    onClick={() => onStartPlanning(place)}
                    className="text-sky-200 hover:text-white underline underline-offset-4 transition-colors"
                  >
                    {place}
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Popular Destination Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-[#0B1D3A]">
              Popular Destinations
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-2xl">
              Curated starting points with seasonal timing notes, highlight attractions, and instant
              planner pre-fill.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenExplore}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 hover:text-[#0B1D3A] transition-colors whitespace-nowrap shrink-0"
          >
            Explore all destinations
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DESTINATION_GUIDES.map((guide) => (
            <article
              key={guide.id}
              className="group bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col transition-transform duration-150 hover:-translate-y-0.5"
            >
              <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                <DestinationImage
                  src={guide.imageUrl}
                  alt={`${guide.name}, ${guide.country}`}
                  label={guide.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                  <span>{guide.country}</span>
                  <span aria-hidden="true">·</span>
                  <span>{guide.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{guide.recommendedDays}</span>
                </div>
                <h3 className="text-lg font-bold font-display text-[#0B1D3A]">
                  {guide.name}
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed flex-1">
                  {guide.summary}
                </p>
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => onSelectDestination(guide)}
                    className="text-sm font-medium text-slate-700 hover:text-[#0B1D3A] transition-colors whitespace-nowrap"
                  >
                    View guide
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartPlanning(`${guide.name}, ${guide.country}`)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 hover:text-sky-900 transition-colors whitespace-nowrap"
                  >
                    Plan trip
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 3. Why Choose TripGenie Section */}
      <section className="bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="max-w-2xl mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-[#0B1D3A]">
              Why Choose TripGenie AI
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
              Designed for travellers who want transparent planning math, realistic pacing, and
              flexible control—without fabricated booking claims.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {CAPABILITIES.map((item) => (
              <div
                key={item.number}
                className={`${item.span} bg-[#F8FAFC] border border-slate-200 rounded-2xl p-7 flex flex-col justify-between`}
              >
                <div>
                  <span className="font-mono text-sm font-semibold text-sky-700 tabular-nums">
                    {item.number}
                  </span>
                  <h3 className="mt-3 text-xl font-bold font-display text-[#0B1D3A]">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Conversion Strip */}
          <div className="mt-10 rounded-2xl bg-gradient-to-r from-[#0B1D3A] to-[#123266] text-white p-8 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-sky-300 mb-2">
                <Compass className="w-4 h-4" />
                <span>Personalized Itinerary Engine</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold font-display">
                Ready to map out your next route?
              </h3>
              <p className="mt-1.5 text-sm text-slate-200">
                Enter your dates, traveller count, budget, and style to generate a complete day-wise
                itinerary in seconds.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onStartPlanning()}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0"
            >
              Open Trip Planner
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
