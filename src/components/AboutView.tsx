'use client';

import { ArrowRight, Compass, Layers, ShieldCheck, Wallet } from 'lucide-react';

interface AboutViewProps {
  onStartPlanning: () => void;
}

export function AboutView({ onStartPlanning }: AboutViewProps) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-12">
      <div className="max-w-2xl">
        <p className="text-xs font-medium text-sky-700 mb-2">About TripGenie AI</p>
        <h1 className="text-3xl sm:text-4xl font-bold font-display tracking-tight text-[#0B1D3A]">
          Your Journey, Intelligently Planned.
        </h1>
        <p className="mt-4 text-base text-slate-600 leading-relaxed">
          TripGenie AI is an intelligent travel planning platform built to turn scattered travel
          research into coherent, day-by-day itineraries grounded in realistic budget modeling and
          conversational refinement.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2.5">
          <Compass className="w-6 h-6 text-sky-600" />
          <h2 className="text-lg font-bold font-display text-[#0B1D3A]">
            Coherent Daily Structuring
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Itineraries balance morning, afternoon, and evening slots alongside local transit advice
            and dining suggestions tailored to your travel personality.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2.5">
          <Wallet className="w-6 h-6 text-sky-600" />
          <h2 className="text-lg font-bold font-display text-[#0B1D3A]">
            Transparent Cost Modeling
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Every budget breakdown clearly separates estimated planning ranges from verified live
            booking prices and warns you upfront when a target budget looks tight or unrealistic.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2.5">
          <Layers className="w-6 h-6 text-sky-600" />
          <h2 className="text-lg font-bold font-display text-[#0B1D3A]">
            Modular External Architecture
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Backend flight, accommodation, and seasonal climate adapters are cleanly decoupled so
            verified live travel APIs can be connected seamlessly without rewriting core planning
            workflows.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2.5">
          <ShieldCheck className="w-6 h-6 text-sky-600" />
          <h2 className="text-lg font-bold font-display text-[#0B1D3A]">
            Private Cloud Persistence
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Authenticated accounts store saved trips and AI refinement conversations in Firestore
            under strict per-user access controls.
          </p>
        </div>
      </div>

      <div className="bg-[#0B1D3A] text-white rounded-2xl p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold font-display">Start building your next route</h2>
          <p className="mt-1 text-sm text-slate-300">
            Configure your dates, destination, travellers, and style in under a minute.
          </p>
        </div>
        <button
          type="button"
          onClick={onStartPlanning}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0"
        >
          Open Trip Planner
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
