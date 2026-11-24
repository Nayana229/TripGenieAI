'use client';

import { ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  contextNote?: string;
}

export function AuthModal({ open, onClose, contextNote }: AuthModalProps) {
  const { signInWithGoogle, authLoading, authError, clearAuthError } = useAuth();

  if (!open) return null;

  async function handleGoogleLogin() {
    const signedInUser = await signInWithGoogle();
    if (signedInUser) {
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1D3A]/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl">
        <button
          type="button"
          onClick={() => {
            clearAuthError();
            onClose();
          }}
          aria-label="Close sign in dialog"
          className="absolute top-5 right-5 p-2 rounded-lg text-slate-400 hover:text-[#0B1D3A] hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <p className="text-xs font-medium text-sky-700 mb-2">TripGenie AI Account</p>
          <h2 id="auth-modal-title" className="text-2xl font-bold font-display text-[#0B1D3A]">
            Sign in to save your journeys
          </h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            {contextNote ||
              'Access your saved itineraries, track upcoming travel budgets, and keep conversational trip refinements synced across devices.'}
          </p>
        </div>

        {authError && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
            {authError}
          </div>
        )}

        <button
          type="button"
          disabled={authLoading}
          onClick={() => void handleGoogleLogin()}
          className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#14305E] transition-colors disabled:opacity-60"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#FFFFFF"
              d="M21.35 11.1h-9.17v2.98h5.27c-.23 1.22-.92 2.25-1.95 2.94v2.45h3.15c1.84-1.7 2.9-4.2 2.9-7.17 0-.69-.06-1.36-.2-1.2z"
            />
            <path
              fill="#38BDF8"
              d="M12.18 21c2.63 0 4.84-.87 6.45-2.36l-3.15-2.45c-.87.58-1.99.93-3.3.93-2.54 0-4.69-1.71-5.46-4.01H3.47v2.52C5.07 18.82 8.37 21 12.18 21z"
            />
            <path
              fill="#BAE6FD"
              d="M6.72 13.11c-.2-.58-.31-1.2-.31-1.84s.11-1.26.31-1.84V6.91H3.47A8.8 8.8 0 0 0 2.5 11.27c0 1.42.34 2.77.97 4.36l3.25-2.52z"
            />
            <path
              fill="#E0F2FE"
              d="M12.18 5.42c1.43 0 2.71.49 3.72 1.46l2.79-2.79C17.01 2.53 14.81 1.54 12.18 1.54 8.37 1.54 5.07 3.72 3.47 6.91l3.25 2.52c.77-2.3 2.92-4.01 5.46-4.01z"
            />
          </svg>
          {authLoading ? 'Signing in...' : 'Continue with Google'}
        </button>

        <div className="mt-5 pt-4 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <span>
            Authenticated via Firebase Security. Your trips and chat history remain strictly private
            to your account.
          </span>
        </div>
      </div>
    </div>
  );
}
