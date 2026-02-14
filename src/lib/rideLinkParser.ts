/**
 * Ride Link Parser - Extract ride details from Uber/Ola/Rapido links
 * Supports sharing links and extracting price, location, ride type, etc.
 */

export interface ParsedRideLink {
  platform: 'uber' | 'ola' | 'rapido' | 'unknown';
  originalLink: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  rideType?: string;
  price?: number;
  currency: string;
  estimatedDuration?: number; // in minutes
  estimatedDistance?: number; // in km
  extractedAt: string;
  isValid: boolean;
  error?: string;
  rawData?: Record<string, any>;
}

/**
 * UBER LINK PARSING
 * Examples:
 * - https://uber.com/request?pickup_latitude=13.1&pickup_longitude=80.2&dropoff_latitude=13.2&dropoff_longitude=80.3
 * - https://www.uber.com/en-IN/request/?pickup=ChIJ..
 * - App share: uber://estimate?dropoff_latitude=13.2&dropoff_longitude=80.3
 */
export const parseUberLink = (link: string): ParsedRideLink => {
  try {
    const url = new URL(link);
    const params = url.searchParams;

    // Extract coordinates
    const pickupLat = params.get('pickup_latitude');
    const pickupLng = params.get('pickup_longitude');
    const dropoffLat = params.get('dropoff_latitude');
    const dropoffLng = params.get('dropoff_longitude');

    // Extract location names (if available)
    const pickupPlaceId = params.get('pickup');
    const dropoffPlaceId = params.get('dropoff');

    // Uber links don't directly contain price in the URL
    // Price is fetched dynamically, so we'll estimate or show as pending
    return {
      platform: 'uber',
      originalLink: link,
      pickupLocation: pickupPlaceId || `(${pickupLat}, ${pickupLng})`,
      dropoffLocation: dropoffPlaceId || `(${dropoffLat}, ${dropoffLng})`,
      rideType: 'Uber',
      price: undefined, // Must be fetched from Uber API
      currency: 'INR',
      estimatedDuration: undefined,
      estimatedDistance: undefined,
      extractedAt: new Date().toISOString(),
      isValid: !!(pickupLat && pickupLng && dropoffLat && dropoffLng),
      rawData: {
        pickupLat,
        pickupLng,
        dropoffLat,
        dropoffLng,
        pickupPlaceId,
        dropoffPlaceId,
      },
      error: !!(pickupLat && pickupLng && dropoffLat && dropoffLng)
        ? undefined
        : 'Could not extract full location from Uber link',
    };
  } catch (err) {
    return {
      platform: 'uber',
      originalLink: link,
      currency: 'INR',
      extractedAt: new Date().toISOString(),
      isValid: false,
      error: `Failed to parse Uber link: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

/**
 * OLA LINK PARSING
 * Examples:
 * - https://olarides.com/payment?booking_id=ABC123&amount=450&currency=INR
 * - https://ola.co/en-IN/ride?source=13.0827,80.2707&destination=13.1939,80.2738
 */
export const parseOlaLink = (link: string): ParsedRideLink => {
  try {
    const url = new URL(link);
    const params = url.searchParams;

    // Ola share link format
    const bookingId = params.get('booking_id');
    const amount = params.get('amount');
    const currency = params.get('currency') || 'INR';

    // Location format in Ola: source=lat,lng&destination=lat,lng
    const source = params.get('source');
    const destination = params.get('destination');

    let pickupLocation = 'Pickup Location';
    let dropoffLocation = 'Drop Location';

    if (source) {
      const [lat, lng] = source.split(',');
      pickupLocation = `(${lat}, ${lng})`;
    }

    if (destination) {
      const [lat, lng] = destination.split(',');
      dropoffLocation = `(${lat}, ${lng})`;
    }

    const price = amount ? parseFloat(amount) : undefined;

    return {
      platform: 'ola',
      originalLink: link,
      pickupLocation,
      dropoffLocation,
      rideType: 'Ola',
      price,
      currency,
      estimatedDuration: undefined,
      estimatedDistance: undefined,
      extractedAt: new Date().toISOString(),
      isValid: !!(price && source && destination),
      rawData: {
        bookingId,
        source,
        destination,
        amount,
      },
      error: !!(source && destination)
        ? undefined
        : 'Could not extract full location from Ola link',
    };
  } catch (err) {
    return {
      platform: 'ola',
      originalLink: link,
      currency: 'INR',
      extractedAt: new Date().toISOString(),
      isValid: false,
      error: `Failed to parse Ola link: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

/**
 * RAPIDO LINK PARSING
 * Examples:
 * - https://www.rapido.bike/bookingdetails?id=XYZ123&amount=199
 * - rapido://ride?pickup=13.0827,80.2707&dropoff=13.1939,80.2738&price=199
 */
export const parseRapidoLink = (link: string): ParsedRideLink => {
  try {
    const url = new URL(link);
    const params = url.searchParams;

    // Rapido sharing format
    const bookingId = params.get('id');
    const amount = params.get('amount');

    // Ride details
    const pickup = params.get('pickup');
    const dropoff = params.get('dropoff');
    const price = params.get('price');

    let pickupLocation = 'Pickup Location';
    let dropoffLocation = 'Drop Location';

    if (pickup) {
      const [lat, lng] = pickup.split(',');
      pickupLocation = `(${lat}, ${lng})`;
    }

    if (dropoff) {
      const [lat, lng] = dropoff.split(',');
      dropoffLocation = `(${lat}, ${lng})`;
    }

    const finalPrice = price ? parseFloat(price) : amount ? parseFloat(amount) : undefined;

    return {
      platform: 'rapido',
      originalLink: link,
      pickupLocation,
      dropoffLocation,
      rideType: 'Rapido Bike',
      price: finalPrice,
      currency: 'INR',
      estimatedDuration: undefined,
      estimatedDistance: undefined,
      extractedAt: new Date().toISOString(),
      isValid: !!(finalPrice && pickup && dropoff),
      rawData: {
        bookingId,
        pickup,
        dropoff,
      },
      error: !!(pickup && dropoff)
        ? undefined
        : 'Could not extract full location from Rapido link',
    };
  } catch (err) {
    return {
      platform: 'rapido',
      originalLink: link,
      currency: 'INR',
      extractedAt: new Date().toISOString(),
      isValid: false,
      error: `Failed to parse Rapido link: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

/**
 * Generic link parser - detects platform and parses
 */
export const parseRideLink = (link: string): ParsedRideLink => {
  // Normalize link
  const normalizedLink = link.trim();

  // Detect platform
  if (normalizedLink.includes('uber.com') || normalizedLink.includes('uber://')) {
    return parseUberLink(normalizedLink);
  } else if (normalizedLink.includes('ola') || normalizedLink.includes('olarides.com')) {
    return parseOlaLink(normalizedLink);
  } else if (normalizedLink.includes('rapido') || normalizedLink.includes('rapido.bike')) {
    return parseRapidoLink(normalizedLink);
  } else {
    // Try to guess based on URL structure
    try {
      const url = new URL(normalizedLink);
      if (url.hostname.includes('uber')) return parseUberLink(normalizedLink);
      if (url.hostname.includes('ola')) return parseOlaLink(normalizedLink);
      if (url.hostname.includes('rapido')) return parseRapidoLink(normalizedLink);
    } catch {
      // Not a valid URL
    }

    return {
      platform: 'unknown',
      originalLink: normalizedLink,
      currency: 'INR',
      extractedAt: new Date().toISOString(),
      isValid: false,
      error: 'Could not detect ride platform. Please use Uber, Ola, or Rapido link.',
    };
  }
};

/**
 * Validate parsed link
 */
export const isValidParsedLink = (parsed: ParsedRideLink): boolean => {
  if (parsed.platform === 'unknown') return false;
  if (!parsed.pickupLocation || !parsed.dropoffLocation) return false;
  return true;
};

/**
 * Format price for display
 */
export const formatPrice = (price: number | undefined, currency: string = 'INR'): string => {
  if (!price) return 'Price pending';
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
  }).format(price);
  return formatted;
};

/**
 * Calculate split cost
 */
export const calculateSplit = (
  totalPrice: number,
  numberOfPeople: number
): { perPerson: number; total: number } => {
  return {
    perPerson: Math.round((totalPrice / numberOfPeople) * 100) / 100,
    total: totalPrice,
  };
};

/**
 * Test link parsing (for development)
 */
export const testLinkParsing = () => {
  const testLinks = [
    'https://uber.com/request?pickup_latitude=13.0827&pickup_longitude=80.2707&dropoff_latitude=13.1939&dropoff_longitude=80.2738',
    'https://olarides.com/payment?booking_id=OLA123&amount=450&currency=INR&source=13.0827,80.2707&destination=13.1939,80.2738',
    'https://www.rapido.bike/bookingdetails?id=RAP123&amount=199&pickup=13.0827,80.2707&dropoff=13.1939,80.2738',
  ];

  console.log('Testing link parsing:');
  testLinks.forEach((link) => {
    const parsed = parseRideLink(link);
    console.log(`\n📍 ${parsed.platform.toUpperCase()}:`);
    console.log(`   From: ${parsed.pickupLocation}`);
    console.log(`   To: ${parsed.dropoffLocation}`);
    console.log(`   Price: ${formatPrice(parsed.price)}`);
    console.log(`   Valid: ${parsed.isValid}`);
    if (parsed.error) console.log(`   Error: ${parsed.error}`);
  });
};
