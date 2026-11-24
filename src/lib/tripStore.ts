import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  BLUEPRINT_LIMITS,
  SUPPORTED_CURRENCIES,
  type ChatMessage,
  type CurrencyCode,
  type ItineraryData,
  type SavedTrip,
  type TripInput,
  type TripStatus,
} from '../types/travel';

function clampString(val: string, min: number, max: number, fallback: string): string {
  const trimmed = (val || '').trim().slice(0, max);
  return trimmed.length >= min ? trimmed : fallback;
}

function generateSafeId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '')
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`.slice(0, BLUEPRINT_LIMITS.ID_MAX);
}

function sanitizeCurrency(currency: CurrencyCode): CurrencyCode {
  return SUPPORTED_CURRENCIES.includes(currency) ? currency : 'USD';
}

function sanitizePreferences(prefs: string[]): string[] {
  return (prefs || [])
    .map((p) => p.trim().slice(0, BLUEPRINT_LIMITS.PREFERENCE_ITEM_MAX))
    .filter(Boolean)
    .slice(0, BLUEPRINT_LIMITS.PREFERENCES_MAX_ITEMS);
}

export async function ensureUserProfile(user: User): Promise<{ preferredCurrency: CurrencyCode }> {
  const userPath = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      return {
        preferredCurrency: sanitizeCurrency(data.preferredCurrency as CurrencyCode),
      };
    }

    const displayName = clampString(
      user.displayName || user.email?.split('@')[0] || 'Traveller',
      1,
      120,
      'Traveller'
    );
    const email = clampString(user.email || 'user@tripgenie.ai', 3, 254, 'user@tripgenie.ai');

    await setDoc(ref, {
      uid: user.uid,
      displayName,
      email,
      preferredCurrency: 'USD',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { preferredCurrency: 'USD' };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function updateUserPreferredCurrency(
  user: User,
  preferredCurrency: CurrencyCode
): Promise<void> {
  const userPath = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    await updateDoc(ref, {
      preferredCurrency: sanitizeCurrency(preferredCurrency),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function getSavedTripById(tripId: string): Promise<SavedTrip | null> {
  const docPath = `trips/${tripId}`;
  try {
    const snap = await getDoc(doc(db, 'trips', tripId));
    if (!snap.exists()) return null;
    return snap.data() as SavedTrip;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }
}

export function subscribeUserTrips(
  userId: string,
  onData: (trips: SavedTrip[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const tripsPath = 'trips';
  const q = query(
    collection(db, tripsPath),
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: SavedTrip[] = snapshot.docs.map((d) => d.data() as SavedTrip);
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, tripsPath);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function createSavedTrip(params: {
  userId: string;
  title?: string;
  input: TripInput;
  itinerary: ItineraryData;
  status?: TripStatus;
  notes?: string;
}): Promise<SavedTrip> {
  const tripId = generateSafeId('trip');
  const docPath = `trips/${tripId}`;
  const ref = doc(db, 'trips', tripId);

  const sanitizedDays = params.itinerary.days.slice(0, BLUEPRINT_LIMITS.DAYS_MAX);
  const sanitizedItinerary: ItineraryData = {
    overview: params.itinerary.overview,
    budgetAnalysis: params.itinerary.budgetAnalysis,
    days: sanitizedDays,
  };

  const payload = {
    id: tripId,
    userId: params.userId,
    title: clampString(
      params.title || `${params.input.destination} (${params.itinerary.days.length} Days)`,
      BLUEPRINT_LIMITS.TITLE_MIN,
      BLUEPRINT_LIMITS.TITLE_MAX,
      'Custom Trip'
    ),
    startLocation: clampString(
      params.input.startLocation,
      BLUEPRINT_LIMITS.LOCATION_MIN,
      BLUEPRINT_LIMITS.LOCATION_MAX,
      'Origin'
    ),
    destination: clampString(
      params.input.destination,
      BLUEPRINT_LIMITS.LOCATION_MIN,
      BLUEPRINT_LIMITS.LOCATION_MAX,
      'Destination'
    ),
    startDate: params.input.startDate,
    endDate: params.input.endDate,
    travellers: Math.max(
      BLUEPRINT_LIMITS.TRAVELLERS_MIN,
      Math.min(BLUEPRINT_LIMITS.TRAVELLERS_MAX, Math.round(params.input.travellers))
    ),
    totalBudget: Math.max(1, Math.min(100_000_000, Number(params.input.totalBudget))),
    currency: sanitizeCurrency(params.input.currency),
    personality: params.input.personality,
    accommodation: clampString(
      params.input.accommodation,
      BLUEPRINT_LIMITS.ACCOMMODATION_MIN,
      BLUEPRINT_LIMITS.ACCOMMODATION_MAX,
      'Boutique Hotel'
    ),
    preferences: sanitizePreferences(params.input.preferences),
    status: params.status || 'upcoming',
    notes: clampString(params.notes || '', 0, BLUEPRINT_LIMITS.NOTES_MAX, ''),
    itinerary: sanitizedItinerary,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(ref, payload);
    return {
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function updateSavedTrip(
  tripId: string,
  currentStatus: TripStatus,
  updates: Partial<{
    title: string;
    startLocation: string;
    destination: string;
    startDate: string;
    endDate: string;
    travellers: number;
    totalBudget: number;
    currency: CurrencyCode;
    personality: TripInput['personality'];
    accommodation: string;
    preferences: string[];
    status: TripStatus;
    notes: string;
    itinerary: ItineraryData;
  }>
): Promise<void> {
  const docPath = `trips/${tripId}`;
  const ref = doc(db, 'trips', tripId);

  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (currentStatus === 'completed') {
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.notes !== undefined) {
      payload.notes = clampString(updates.notes, 0, BLUEPRINT_LIMITS.NOTES_MAX, '');
    }
  } else {
    if (updates.title !== undefined) {
      payload.title = clampString(
        updates.title,
        BLUEPRINT_LIMITS.TITLE_MIN,
        BLUEPRINT_LIMITS.TITLE_MAX,
        'Custom Trip'
      );
    }
    if (updates.startLocation !== undefined) {
      payload.startLocation = clampString(
        updates.startLocation,
        BLUEPRINT_LIMITS.LOCATION_MIN,
        BLUEPRINT_LIMITS.LOCATION_MAX,
        'Origin'
      );
    }
    if (updates.destination !== undefined) {
      payload.destination = clampString(
        updates.destination,
        BLUEPRINT_LIMITS.LOCATION_MIN,
        BLUEPRINT_LIMITS.LOCATION_MAX,
        'Destination'
      );
    }
    if (updates.startDate !== undefined) payload.startDate = updates.startDate;
    if (updates.endDate !== undefined) payload.endDate = updates.endDate;
    if (updates.travellers !== undefined) {
      payload.travellers = Math.max(
        BLUEPRINT_LIMITS.TRAVELLERS_MIN,
        Math.min(BLUEPRINT_LIMITS.TRAVELLERS_MAX, Math.round(updates.travellers))
      );
    }
    if (updates.totalBudget !== undefined) {
      payload.totalBudget = Math.max(1, Math.min(100_000_000, Number(updates.totalBudget)));
    }
    if (updates.currency !== undefined) payload.currency = sanitizeCurrency(updates.currency);
    if (updates.personality !== undefined) payload.personality = updates.personality;
    if (updates.accommodation !== undefined) {
      payload.accommodation = clampString(
        updates.accommodation,
        BLUEPRINT_LIMITS.ACCOMMODATION_MIN,
        BLUEPRINT_LIMITS.ACCOMMODATION_MAX,
        'Boutique Hotel'
      );
    }
    if (updates.preferences !== undefined) {
      payload.preferences = sanitizePreferences(updates.preferences);
    }
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.notes !== undefined) {
      payload.notes = clampString(updates.notes, 0, BLUEPRINT_LIMITS.NOTES_MAX, '');
    }
    if (updates.itinerary !== undefined) {
      payload.itinerary = {
        overview: updates.itinerary.overview,
        budgetAnalysis: updates.itinerary.budgetAnalysis,
        days: updates.itinerary.days.slice(0, BLUEPRINT_LIMITS.DAYS_MAX),
      };
    }
  }

  try {
    await updateDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function deleteSavedTrip(tripId: string, userId: string): Promise<void> {
  const messagesPath = `trips/${tripId}/messages`;
  const docPath = `trips/${tripId}`;
  try {
    const msgsQuery = query(
      collection(db, messagesPath),
      where('userId', '==', userId),
      where('tripId', '==', tripId)
    );
    const msgSnap = await getDocs(msgsQuery);
    await Promise.all(msgSnap.docs.map((m) => deleteDoc(m.ref)));
    await deleteDoc(doc(db, 'trips', tripId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export function subscribeTripMessages(
  tripId: string,
  userId: string,
  onData: (messages: ChatMessage[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `trips/${tripId}/messages`;
  const q = query(
    collection(db, path),
    where('userId', '==', userId),
    where('tripId', '==', tripId),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((d) => d.data() as ChatMessage));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function addTripMessage(params: {
  tripId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  appliedUpdate: boolean;
}): Promise<void> {
  const messageId = generateSafeId('msg');
  const path = `trips/${params.tripId}/messages/${messageId}`;
  const ref = doc(db, 'trips', params.tripId, 'messages', messageId);

  try {
    await setDoc(ref, {
      id: messageId,
      tripId: params.tripId,
      userId: params.userId,
      role: params.role,
      content: clampString(params.content, 1, BLUEPRINT_LIMITS.MESSAGE_MAX, '...'),
      appliedUpdate: Boolean(params.appliedUpdate),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
