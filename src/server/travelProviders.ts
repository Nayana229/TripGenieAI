import type { CurrencyCode, TripInput } from '../types/travel';

/**
 * Modular integration interfaces for future external travel APIs
 * (flights, accommodations, weather advisories).
 * Current implementation returns transparent planning-guidance metadata only
 * and never fabricates live availability, live pricing, or live weather.
 */

export interface ExternalProviderEstimateNote {
  providerModule: string;
  isLiveData: false;
  advisory: string;
}

export interface FlightProviderAdapter {
  getPlanningAdvisory(input: TripInput): Promise<ExternalProviderEstimateNote>;
}

export interface AccommodationProviderAdapter {
  getPlanningAdvisory(input: TripInput): Promise<ExternalProviderEstimateNote>;
}

export interface WeatherProviderAdapter {
  getSeasonalAdvisory(destination: string, startDate: string): Promise<ExternalProviderEstimateNote>;
}

export const modularTravelAdapters: {
  flights: FlightProviderAdapter;
  accommodation: AccommodationProviderAdapter;
  weather: WeatherProviderAdapter;
} = {
  flights: {
    async getPlanningAdvisory(input: TripInput) {
      return {
        providerModule: 'flight-estimator-v1 (modular stub)',
        isLiveData: false,
        advisory: `Flight estimates between ${input.startLocation} and ${input.destination} in ${input.currency} are modeled planning ranges, not live carrier inventory or fares.`,
      };
    },
  },
  accommodation: {
    async getPlanningAdvisory(input: TripInput) {
      return {
        providerModule: 'lodging-estimator-v1 (modular stub)',
        isLiveData: false,
        advisory: `${input.accommodation} nightly rates reflect estimated seasonal planning benchmarks rather than live property availability.`,
      };
    },
  },
  weather: {
    async getSeasonalAdvisory(destination: string, startDate: string) {
      return {
        providerModule: 'seasonal-climate-v1 (modular stub)',
        isLiveData: false,
        advisory: `Packing and pacing notes for ${destination} around ${startDate} are based on general seasonal norms, not live meteorological forecasts.`,
      };
    },
  },
};

export function getCurrencyRoughBaselineNote(currency: CurrencyCode): string {
  return `All monetary amounts are estimated planning figures denominated in ${currency}.`;
}
