export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'AUD', 'CAD', 'CHF'] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  INR: '₹',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF ',
};

export const TRAVEL_PERSONALITIES = [
  'Adventure',
  'Nature',
  'Food',
  'Spiritual',
  'Luxury',
  'Budget',
] as const;
export type TravelPersonality = (typeof TRAVEL_PERSONALITIES)[number];

export const ACCOMMODATION_OPTIONS = [
  'Boutique Hotel',
  'Luxury Resort',
  'Heritage Riad / Ryokan',
  'Vacation Apartment',
  'Eco-Lodge',
  'Cozy Hostel / Budget Stay',
] as const;

export const PREFERENCE_OPTIONS = [
  'Cultural Immersion',
  'Local Cuisine & Markets',
  'Hidden Gems',
  'Scenic Routes',
  'Museums & Architecture',
  'Wellness & Slow Pace',
  'Outdoor Hiking',
  'Photography Spots',
  'Evening Entertainment',
  'Family Friendly',
] as const;

export const TRIP_STATUSES = ['upcoming', 'completed', 'draft'] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const BLUEPRINT_LIMITS = {
  ID_MAX: 128,
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  TITLE_MIN: 2,
  TITLE_MAX: 140,
  LOCATION_MIN: 2,
  LOCATION_MAX: 120,
  ACCOMMODATION_MIN: 2,
  ACCOMMODATION_MAX: 80,
  PREFERENCES_MAX_ITEMS: 12,
  PREFERENCE_ITEM_MAX: 60,
  NOTES_MAX: 1000,
  DAYS_MAX: 14,
  TRAVELLERS_MIN: 1,
  TRAVELLERS_MAX: 20,
  MESSAGE_MAX: 6000,
} as const;

export interface TripInput {
  startLocation: string;
  destination: string;
  startDate: string;
  endDate: string;
  travellers: number;
  totalBudget: number;
  currency: CurrencyCode;
  personality: TravelPersonality;
  accommodation: string;
  preferences: string[];
}

export interface ActivitySlot {
  title: string;
  description: string;
  location: string;
  duration: string;
  estimatedCost: number;
}

export interface FoodRecommendation {
  name: string;
  cuisine: string;
  dishToTry: string;
  priceNote: string;
}

export interface DayPlan {
  dayNumber: number;
  date: string;
  theme: string;
  morning: ActivitySlot;
  afternoon: ActivitySlot;
  evening: ActivitySlot;
  recommendedAttractions: string[];
  foodRecommendations: FoodRecommendation[];
  estimatedDayExpense: number;
  travelSuggestions: string[];
}

export interface BudgetCategoryBreakdown {
  amount: number;
  percentage: number;
  note: string;
}

export interface BudgetAnalysis {
  realismStatus: 'realistic' | 'tight' | 'unrealistic';
  isRealistic: boolean;
  warningMessage: string;
  estimatedTotal: number;
  userBudget: number;
  currency: CurrencyCode;
  priceDisclaimer: string;
  breakdown: {
    transportation: BudgetCategoryBreakdown;
    accommodation: BudgetCategoryBreakdown;
    food: BudgetCategoryBreakdown;
    activities: BudgetCategoryBreakdown;
  };
  savingTips: string[];
}

export interface ItineraryOverview {
  summary: string;
  bestTimeTip: string;
  localTransportNote: string;
  estimationDisclaimer: string;
}

export interface ItineraryData {
  overview: ItineraryOverview;
  budgetAnalysis: BudgetAnalysis;
  days: DayPlan[];
}

export interface SavedTrip extends TripInput {
  id: string;
  userId: string;
  title: string;
  status: TripStatus;
  notes: string;
  itinerary: ItineraryData;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface ChatMessage {
  id: string;
  tripId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  appliedUpdate: boolean;
  createdAt: unknown;
}

export interface DestinationGuide {
  id: string;
  name: string;
  country: string;
  region: string;
  category: 'Coastal' | 'Cultural' | 'Alpine' | 'Oasis' | 'Wilderness';
  imageUrl: string;
  summary: string;
  idealWindow: string;
  recommendedDays: string;
  personalities: TravelPersonality[];
  popularAttractions: string[];
  planningNotes: string;
}
