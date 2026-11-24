'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NavbarProps {
  onOpenAuth: () => void;
}

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/explore', label: 'Explore' },
  { href: '/my-trips', label: 'My Trips' },
  { href: '/about', label: 'About' },
] as const;

export function Navbar({ onOpenAuth }: NavbarProps) {
  const { user, logout, authLoading } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isNavActive(href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single clean wordmark */}
        <Link
          href="/"
          onClick={() => setMobileOpen(false)}
          className="text-lg sm:text-xl font-bold font-display tracking-tight text-[#0B1D3A] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-sky-500 rounded-md"
        >
          TripGenie AI
        </Link>

        {/* Zone 2: 4 concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-8" aria-label="Primary Navigation">
          {NAV_ITEMS.map((item) => {
            const active = isNavActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-sky-500 ${
                  active
                    ? 'text-[#0B1D3A] border-sky-500'
                    : 'text-slate-600 border-transparent hover:text-[#0B1D3A] hover:border-slate-300'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="hidden md:flex items-center shrink-0">
          {user ? (
            <button
              type="button"
              disabled={authLoading}
              onClick={() => void logout()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-[#0B1D3A] text-sm font-medium hover:bg-slate-50 transition-colors duration-150 whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <span className="max-w-[140px] truncate">{user.displayName || user.email}</span>
              <LogOut className="w-4 h-4 text-slate-500" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-5 py-2 rounded-lg bg-[#0B1D3A] text-white text-sm font-medium hover:bg-[#14305E] transition-colors duration-150 whitespace-nowrap shrink-0"
            >
              Login
            </button>
          )}
        </div>

        {/* Mobile Menu Trigger */}
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="md:hidden p-2 rounded-lg text-[#0B1D3A] hover:bg-slate-100 transition-colors"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isNavActive(item.href)
                  ? 'bg-sky-50 text-[#0B1D3A]'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-[#0B1D3A]'
              }`}
            >
              {item.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-slate-100">
            {user ? (
              <button
                type="button"
                disabled={authLoading}
                onClick={() => {
                  setMobileOpen(false);
                  void logout();
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-[#0B1D3A]"
              >
                <span className="truncate">{user.displayName || user.email}</span>
                <span className="text-slate-500">Sign Out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onOpenAuth();
                }}
                className="w-full py-2.5 rounded-lg bg-[#0B1D3A] text-white text-sm font-medium"
              >
                Login
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
