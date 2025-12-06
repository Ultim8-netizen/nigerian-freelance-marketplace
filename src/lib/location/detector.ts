// src/lib/location/detector.ts
// Browser-based location detection

interface GeoLocationResult {
  state: NigerianState | null;
  city: string | null;
  coordinates: { latitude: number; longitude: number } | null;
}

/**
 * Detect user location using browser Geolocation API
 * Only requests coarse location (city-level)
 */
export async function detectBrowserLocation(): Promise<GeoLocationResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ state: null, city: null, coordinates: null });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          // Use reverse geocoding to get city/state
          const location = await reverseGeocode(latitude, longitude);
          resolve({
            state: location.state,
            city: location.city,
            coordinates: { latitude, longitude },
          });
        } catch (error) {
          console.error('Reverse geocoding failed:', error);
          resolve({ 
            state: null, 
            city: null, 
            coordinates: { latitude, longitude } 
          });
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        resolve({ state: null, city: null, coordinates: null });
      },
      {
        enableHighAccuracy: false, // Coarse location only
        timeout: 10000,
        maximumAge: 3600000, // Cache for 1 hour
      }
    );
  });
}
/**
 * Reverse geocode coordinates to Nigerian location
 * Using free Nominatim API (OpenStreetMap)
 */
async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<{ state: NigerianState | null; city: string | null }> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=10`,
      {
        headers: {
          'User-Agent': 'NigerianFreelanceMarketplace/1.0',
        },
      }
    );

    const data = await response.json();
    const address = data.address;

    // Extract state and city from response
    const state = findNigerianState(
      address.state || address.region || address.county
    );
    const city = address.city || address.town || address.village;

    return { state, city };
  } catch (error) {
    console.error('Reverse geocoding failed:', error);
    return { state: null, city: null };
  }
}

/**
 * Match detected state name to Nigerian state
 */
function findNigerianState(detectedState: string): NigerianState | null {
  if (!detectedState) return null;

  const normalized = detectedState.toLowerCase().trim();
  
  // Handle FCT variations
  if (normalized.includes('fct') || normalized.includes('abuja')) {
    return 'FCT';
  }

  // Find matching state
  return NIGERIAN_STATES.find(
    (state) => state.toLowerCase() === normalized
  ) || null;
}

/**
 * Detect location from IP address (fallback)
 * Using ipapi.co free tier
 */
export async function detectIPLocation(): Promise<GeoLocationResult> {
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();

    if (data.country_code !== 'NG') {
      return { state: null, city: null, coordinates: null };
    }

    const state = findNigerianState(data.region);
    const city = data.city;

    return {
      state,
      city,
      coordinates: data.latitude && data.longitude
        ? { latitude: data.latitude, longitude: data.longitude }
        : null,
    };
  } catch (error) {
    console.error('IP location detection failed:', error);
    return { state: null, city: null, coordinates: null };
  }
}