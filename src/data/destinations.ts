import type { DestinationGuide } from '../types/travel';

export const DESTINATION_GUIDES: DestinationGuide[] = [
  {
    id: 'amalfi-coast',
    name: 'Amalfi Coast',
    country: 'Italy',
    region: 'Campania · Mediterranean',
    category: 'Coastal',
    imageUrl: '/images/hero_amalfi_coast_1795494747344.jpg',
    summary:
      'Vertical cliffside villages, lemon groves terraced above deep navy waters, and centuries-old coastal footpaths linking Positano, Ravello, and Amalfi.',
    idealWindow: 'May to June · September to October',
    recommendedDays: '4 to 6 days',
    personalities: ['Luxury', 'Food', 'Nature'],
    popularAttractions: [
      'Sentiero degli Dei (Path of the Gods)',
      'Villa Cimbrone Gardens in Ravello',
      'Amalfi Cathedral & Cloister of Paradise',
      'Positano Marina Grande & Fornillo Cove',
    ],
    planningNotes:
      'Coastal ferries bypass summer cliffside road traffic cleanly between Positano, Amalfi, and Capri.',
  },
  {
    id: 'kyoto',
    name: 'Kyoto',
    country: 'Japan',
    region: 'Kansai · Honshu',
    category: 'Cultural',
    imageUrl: '/images/dest_kyoto_autumn_1795494747792.jpg',
    summary:
      'Imperial temples, cedar-lined lantern alleys, kaiseki dining rooms, and tranquil moss gardens spanning Higashiyama, Arashiyama, and Uji.',
    idealWindow: 'March to April · October to November',
    recommendedDays: '5 to 7 days',
    personalities: ['Spiritual', 'Food', 'Nature'],
    popularAttractions: [
      'Kiyomizu-dera Wooden Stage & Ninenzaka',
      'Fushimi Inari Taisha Mountain Trails',
      'Arashiyama Bamboo Grove & Tenryu-ji',
      'Nishiki Market Culinary Arcade',
    ],
    planningNotes:
      'Arriving at major temple gates before 07:30 unlocks quiet paths before mid-morning tour coaches arrive.',
  },
  {
    id: 'santorini',
    name: 'Santorini',
    country: 'Greece',
    region: 'Cyclades · Aegean Sea',
    category: 'Coastal',
    imageUrl: '/images/dest_santorini_aegean_1795494748189.jpg',
    summary:
      'Volcanic caldera ridges crowned with Cycladic whitewashed architecture, cliffside footpaths from Fira to Oia, and mineral-rich island vineyards.',
    idealWindow: 'April to June · September to October',
    recommendedDays: '3 to 5 days',
    personalities: ['Luxury', 'Food', 'Spiritual'],
    popularAttractions: [
      'Fira to Oia Caldera Cliff Trail',
      'Akrotiri Bronze Age Archaeological Site',
      'Pyrgos Kallistis Hilltop Village',
      'Amoudi Bay Waterfront Tavernas',
    ],
    planningNotes:
      'Splitting stays between central Fira or Imerovigli and quiet southern villages balances sunset views with calmer evenings.',
  },
  {
    id: 'zermatt-swiss-alps',
    name: 'Zermatt & Swiss Alps',
    country: 'Switzerland',
    region: 'Valais · Pennine Alps',
    category: 'Alpine',
    imageUrl: '/images/dest_swiss_alps_1795494748265.jpg',
    summary:
      'Car-free alpine timber villages framed by glacial lakes, cogwheel mountain railways, and high-altitude panoramic ridges beneath the Matterhorn.',
    idealWindow: 'June to September · December to March',
    recommendedDays: '4 to 6 days',
    personalities: ['Adventure', 'Nature', 'Luxury'],
    popularAttractions: [
      'Gornergrat Cogwheel Railway',
      'Five Lakes Walk (5-Seenweg)',
      'Matterhorn Glacier Paradise',
      'Hinterdorf Historic Timber Quarter',
    ],
    planningNotes:
      'Regional rail passes often reduce mountain gondola and cogwheel railway fares noticeably across multi-day alpine itineraries.',
  },
  {
    id: 'marrakech',
    name: 'Marrakech',
    country: 'Morocco',
    region: 'Marrakech-Safi · Atlas Foothills',
    category: 'Oasis',
    imageUrl: '/images/dest_marrakech_riad_1795494748195.jpg',
    summary:
      'Intricately tiled courtyard riads, aromatic spice souks, desert palm oases, and dramatic day routes up toward the High Atlas peaks.',
    idealWindow: 'March to May · October to November',
    recommendedDays: '4 to 5 days',
    personalities: ['Food', 'Spiritual', 'Budget'],
    popularAttractions: [
      'Jardin Majorelle & Yves Saint Laurent Museum',
      'Bahia Palace & Ben Youssef Madrasa',
      'Medina Artisanal Souks & Spice Square',
      'Ourika Valley High Atlas Foothills',
    ],
    planningNotes:
      'Staying inside a restored Medina riad offers tranquil courtyard refuge steps away from vibrant market lanes.',
  },
  {
    id: 'patagonia',
    name: 'Patagonia (Torres del Paine)',
    country: 'Chile',
    region: 'Magallanes · Southern Andes',
    category: 'Wilderness',
    imageUrl: '/images/dest_patagonia_peaks_1795494749046.jpg',
    summary:
      'Granite spires, turquoise glacial lakes, and windswept steppe trails offering some of the Southern Hemisphere’s most dramatic wilderness trekking.',
    idealWindow: 'November to March',
    recommendedDays: '6 to 8 days',
    personalities: ['Adventure', 'Nature', 'Budget'],
    popularAttractions: [
      'Mirador Base Las Torres Trail',
      'Grey Glacier & Lake Boat Crossing',
      'Cuernos del Paine Lookout',
      'French Valley Granite Amphitheater',
    ],
    planningNotes:
      'Layering windproof shells is essential year-round due to sudden Patagonian gusts across exposed valley passes.',
  },
];
