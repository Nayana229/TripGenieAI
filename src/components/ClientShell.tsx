'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AuthProvider } from '../contexts/AuthContext';
import { AuthModal } from './AuthModal';
import { ErrorBoundary } from './ErrorBoundary';
import { Navbar } from './Navbar';

interface AuthModalContextValue {
  openAuthModal: (contextNote?: string) => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext);
  if (!ctx) {
    throw new Error('useAuthModal must be used inside ClientShell');
  }
  return ctx;
}

export function ClientShell({ children }: { children: ReactNode }) {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authContextNote, setAuthContextNote] = useState<string | undefined>(undefined);

  function openAuthModal(contextNote?: string) {
    setAuthContextNote(contextNote);
    setAuthModalOpen(true);
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <AuthModalContext.Provider value={{ openAuthModal }}>
          <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0B1D3A]">
            <Navbar onOpenAuth={() => openAuthModal()} />

            <main className="flex-1">{children}</main>

            <footer className="bg-white border-t border-slate-200 mt-12">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
                <div>
                  <span className="font-display font-bold text-sm text-[#0B1D3A]">TripGenie AI</span>
                  <span className="mx-2" aria-hidden="true">·</span>
                  <span>Your Journey, Intelligently Planned.</span>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <Link href="/explore" className="hover:text-[#0B1D3A] transition-colors">
                    Explore
                  </Link>
                  <Link href="/planner" className="hover:text-[#0B1D3A] transition-colors">
                    Trip Planner
                  </Link>
                  <Link href="/my-trips" className="hover:text-[#0B1D3A] transition-colors">
                    My Trips
                  </Link>
                  <Link href="/about" className="hover:text-[#0B1D3A] transition-colors">
                    About
                  </Link>
                </div>
              </div>
            </footer>

            <AuthModal
              open={authModalOpen}
              onClose={() => setAuthModalOpen(false)}
              contextNote={authContextNote}
            />
          </div>
        </AuthModalContext.Provider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
