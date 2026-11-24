'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { ensureUserProfile, updateUserPreferredCurrency } from '../lib/tripStore';
import type { CurrencyCode } from '../types/travel';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  authLoading: boolean;
  authError: string | null;
  preferredCurrency: CurrencyCode;
  signInWithGoogle: () => Promise<User | null>;
  logout: () => Promise<void>;
  setPreferredCurrency: (currency: CurrencyCode) => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [preferredCurrency, setPreferredCurrencyState] = useState<CurrencyCode>('USD');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        try {
          const profile = await ensureUserProfile(nextUser);
          setPreferredCurrencyState(profile.preferredCurrency);
        } catch (err) {
          console.error('Failed to sync user profile:', err);
        }
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  async function signInWithGoogle(): Promise<User | null> {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      let message = 'Unable to sign in with Google.';
      if (error instanceof Error) {
        if (error.message.includes('popup-closed-by-user')) {
          message = 'Sign-in window was closed before completing authentication.';
        } else if (error.message.includes('popup-blocked')) {
          message = 'Your browser blocked the Google sign-in popup. Please allow popups and try again.';
        } else if (error.message.includes('unauthorized-domain')) {
          message =
            'This domain is not yet added to Firebase Authorized Domains. Add it in Firebase Console > Authentication > Settings > Authorized domains. You can still plan itineraries freely without signing in.';
        } else {
          message = error.message;
        }
      }
      setAuthError(message);
      return null;
    } finally {
      setAuthLoading(false);
    }
  }

  async function logout(): Promise<void> {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signOut(auth);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to sign out.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function setPreferredCurrency(currency: CurrencyCode): Promise<void> {
    setPreferredCurrencyState(currency);
    if (user) {
      await updateUserPreferredCurrency(user, currency);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        authLoading,
        authError,
        preferredCurrency,
        signInWithGoogle,
        logout,
        setPreferredCurrency,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
