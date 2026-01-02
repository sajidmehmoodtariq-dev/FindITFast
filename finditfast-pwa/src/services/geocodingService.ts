export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

export interface GeocodingResponse {
  results: Array<{
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
    formatted_address: string;
  }>;
  status: string;
}

export class GeocodingService {
  private static readonly GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  private static readonly GEOCODING_BASE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

  /**
   * Convert an address string to latitude/longitude coordinates
   */
  static async geocodeAddress(address: string): Promise<GeocodingResult | null> {
    if (!address.trim()) {
      throw new Error('Address cannot be empty');
    }

    if (!this.GOOGLE_MAPS_API_KEY) {
      console.warn('Google Maps API key not configured. Using fallback geocoding.');
      // Return approximate coordinates based on common locations
      return this.getFallbackCoordinates(address.trim());
    }

    try {
      const encodedAddress = encodeURIComponent(address.trim());
      const url = `${this.GEOCODING_BASE_URL}?address=${encodedAddress}&key=${this.GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn('Geocoding API returned error, using fallback');
        return this.getFallbackCoordinates(address.trim());
      }

      const data: GeocodingResponse = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const result = data.results[0];
        return {
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          formattedAddress: result.formatted_address
        };
      } else if (data.status === 'ZERO_RESULTS') {
        console.warn('No results found, using fallback coordinates');
        return this.getFallbackCoordinates(address.trim());
      } else if (data.status === 'OVER_QUERY_LIMIT') {
        console.warn('API quota exceeded, using fallback coordinates');
        return this.getFallbackCoordinates(address.trim());
      } else if (data.status === 'REQUEST_DENIED') {
        console.warn('API access denied, using fallback coordinates');
        return this.getFallbackCoordinates(address.trim());
      } else {
        console.warn('Geocoding failed, using fallback coordinates');
        return this.getFallbackCoordinates(address.trim());
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      // Always return fallback coordinates instead of throwing
      return this.getFallbackCoordinates(address.trim());
    }
  }

  /**
   * Get fallback coordinates based on address keywords
   */
  private static getFallbackCoordinates(address: string): GeocodingResult {
    const addressLower = address.toLowerCase();
    
    // Australia city coordinates
    const cityCoordinates: Record<string, { lat: number; lng: number }> = {
      'sydney': { lat: -33.8688, lng: 151.2093 },
      'melbourne': { lat: -37.8136, lng: 144.9631 },
      'brisbane': { lat: -27.4698, lng: 153.0251 },
      'perth': { lat: -31.9505, lng: 115.8605 },
      'adelaide': { lat: -34.9285, lng: 138.6007 },
      'canberra': { lat: -35.2809, lng: 149.1300 },
      'hobart': { lat: -42.8821, lng: 147.3272 },
      'darwin': { lat: -12.4634, lng: 130.8456 },
      'gold coast': { lat: -28.0167, lng: 153.4000 },
      'newcastle': { lat: -32.9283, lng: 151.7817 },
    };

    // Check for city matches
    for (const [city, coords] of Object.entries(cityCoordinates)) {
      if (addressLower.includes(city)) {
        return {
          latitude: coords.lat,
          longitude: coords.lng,
          formattedAddress: address
        };
      }
    }

    // Default to Sydney, Australia
    return {
      latitude: -33.8688,
      longitude: 151.2093,
      formattedAddress: address
    };
  }

  /**
   * Reverse geocode coordinates to get an address
   */
  static async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    if (!this.GOOGLE_MAPS_API_KEY) {
      console.warn('Google Maps API key not configured for reverse geocoding.');
      return `${latitude}, ${longitude}`;
    }

    try {
      const url = `${this.GEOCODING_BASE_URL}?latlng=${latitude},${longitude}&key=${this.GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: GeocodingResponse = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        return data.results[0].formatted_address;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      return null;
    }
  }

  /**
   * Validate if an address looks valid (basic check)
   */
  static validateAddress(address: string): boolean {
    if (!address || typeof address !== 'string') {
      return false;
    }

    const trimmed = address.trim();
    
    // Basic validation: should have at least a few words
    const words = trimmed.split(/\s+/);
    if (words.length < 2) {
      return false;
    }

    // Should contain at least one number (for street address)
    const hasNumber = /\d/.test(trimmed);
    if (!hasNumber) {
      return false;
    }

    return true;
  }

  /**
   * Generate Google Maps link for directions
   */
  static generateMapsLink(address: string): string {
    const encodedAddress = encodeURIComponent(address);
    return `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
  }

  /**
   * Generate Apple Maps link for directions
   */
  static generateAppleMapsLink(address: string): string {
    const encodedAddress = encodeURIComponent(address);
    return `http://maps.apple.com/?daddr=${encodedAddress}`;
  }

  /**
   * Generate maps link based on user agent
   */
  static generateDirectionsLink(address: string): string {
    const userAgent = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    
    if (isIOS) {
      return this.generateAppleMapsLink(address);
    } else {
      return this.generateMapsLink(address);
    }
  }
}
