import React, { useState, useCallback, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import { SearchResults } from '../components/search';
import { MobileLayout, MobileContent } from '../components/common/MobileLayout';
import { LazyLoad } from '../components/performance/LazyLoading';
import { SearchService } from '../services/searchService';
import { useGeolocation } from '../hooks/useGeolocation';
import type { SearchResult, SearchState } from '../types/search';

// Custom hook for debouncing
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  
  const [searchInput, setSearchInput] = useState('');
  const defaultBannerText = 'Welcome to FindItFast! Browse our latest deals and featured stores. Check back often for new updates and announcements.';
  const [bannerText, setBannerText] = useState<string>(defaultBannerText);
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    results: [],
    isLoading: false,
    error: null,
    hasSearched: false
  });
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  
  // Geolocation hook for distance calculations
  const geolocation = useGeolocation();

  // Debounce search input
  const debouncedSearchInput = useDebounce(searchInput, 300);

  // Check if we should show location permission prompt
  useEffect(() => {
    if (geolocation.permission === 'prompt' && !geolocation.userLocation && !showLocationPrompt) {
      setShowLocationPrompt(true);
    }
  }, [geolocation.permission, geolocation.userLocation, showLocationPrompt]);



  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) return;

    setSearchState(prev => ({
      ...prev,
      query,
      isLoading: true,
      error: null,
      hasSearched: true
    }));

    try {
      // Include user location for distance calculations if available
      const results = await SearchService.searchItems(query, geolocation.userLocation || undefined);
      
      setSearchState(prev => ({
        ...prev,
        results,
        isLoading: false
      }));
    } catch (error) {
      setSearchState(prev => ({
        ...prev,
        results: [],
        isLoading: false,
        error: error instanceof Error ? error.message : 'Search failed'
      }));
    }
  }, [geolocation.userLocation]);

  // Handle debounced search
  useEffect(() => {
    if (debouncedSearchInput.trim()) {
      performSearch(debouncedSearchInput);
    } else {
      // Clear search results when input is empty
      setSearchState(prev => ({
        ...prev,
        query: '',
        results: [],
        isLoading: false,
        hasSearched: false
      }));
    }
  }, [debouncedSearchInput, performSearch]);

  // Location services removed - search works without location data

  // Subscribe to global banner text from Firestore
  useEffect(() => {
    const configRef = doc(db, 'appConfig', 'public');
    const unsubscribe = onSnapshot(
      configRef,
      (snapshot) => {
        try {
          if (snapshot.exists()) {
            const data = snapshot.data();
            if (data && typeof data.homeBannerText === 'string' && data.homeBannerText.trim()) {
              setBannerText(data.homeBannerText.trim());
            } else {
              setBannerText(defaultBannerText);
            }
          } else {
            setBannerText(defaultBannerText);
          }
        } catch (error) {
          console.error('Error loading home banner config:', error);
          setBannerText(defaultBannerText);
        }
      },
      (error) => {
        console.error('Error in home banner listener:', error);
        setBannerText(defaultBannerText);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleInputChange = useCallback((value: string) => {
    setSearchInput(value);
  }, []);



  const handleResultClick = useCallback((result: SearchResult) => {
    // Use the store request document ID for navigation, not the item's storeId
    navigate(`/item/${result.id}/store/${result.store.id}`);
  }, [navigate]);

  // Handle location permission request
  const handleLocationRequest = useCallback(async () => {
    setShowLocationPrompt(false);
    await geolocation.requestLocation();
  }, [geolocation]);

  const handleLocationDismiss = useCallback(() => {
    setShowLocationPrompt(false);
  }, []);

  // Location request handler removed

  return (
    <MobileLayout>
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-lg border-b border-slate-200/50 sticky top-0 z-40 pt-safe-top">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-medium text-white">FindItFast</h1>
          <button
            onClick={() => navigate('/admin/auth')}
            className="p-2 rounded-2xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            title="Admin Panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      <MobileContent>
        <div className="flex flex-col min-h-full bg-gray-50">
          {/* Main Search Bar */}
          <div className="px-4 py-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="Search for an item..."
                className="w-full pl-10 pr-4 py-3 border-2 border-blue-200 rounded-2xl bg-white text-gray-900 placeholder-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-400 transition-all"
              />
            </div>
          </div>

          {/* Welcome Banner - Hidden during search */}
          {!searchInput.trim() && (
            <div className="px-4 mb-6">
              <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-2xl p-4 border border-blue-200">
                <p className="text-sm text-blue-800 leading-relaxed font-medium">
                  {bannerText}
                </p>
              </div>
            </div>
          )}

          {/* Admin Panel section removed - accessible via gear icon in navigation bar */}

          {/* Location Permission Banner for distance display */}
          {showLocationPrompt && !searchInput.trim() && (
            <div className="px-4 mb-6">
              <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl p-5 shadow-lg border border-blue-100">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-blue-800">Enable Location</h2>
                </div>
                <p className="text-sm text-blue-700 mb-5 font-medium">
                  Get distance information to stores and find the closest options to you.
                </p>
                <div className="flex space-x-3">
                  <button 
                    onClick={handleLocationRequest}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 px-4 rounded-2xl font-bold hover:from-blue-600 hover:to-indigo-600 transition-all transform hover:scale-105 flex items-center justify-center shadow-lg"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Enable Location
                  </button>
                  <button 
                    onClick={handleLocationDismiss}
                    className="px-4 py-3 border border-blue-200 text-blue-700 rounded-2xl font-medium hover:bg-blue-50 transition-colors"
                  >
                    Skip
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Store Owners Section - Hidden during search */}
          {!searchInput.trim() && (
            <div className="px-4 mb-6">
              <div className="bg-gradient-to-br from-white to-green-50 rounded-2xl p-5 shadow-lg border border-green-100">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-green-800">Store Owners</h2>
                </div>
                <p className="text-sm text-green-700 mb-5 font-medium">
                  Join our platform to upload your store layout and help customers find products easily.
                </p>
                <button 
                  onClick={() => navigate('/owner/auth?mode=signup')}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 px-4 rounded-2xl font-bold hover:from-green-600 hover:to-emerald-600 transition-all transform hover:scale-105 flex items-center justify-center shadow-lg"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Store Owner Sign Up
                </button>
              </div>
            </div>
          )}

          {/* Location Status Display */}
          {geolocation.userLocation && !searchInput.trim() && (
            <div className="px-4 mb-6">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-100">
                <div className="flex items-center text-green-700">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium">
                    Location enabled - you'll see distances to stores in search results
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Location Error Display */}
          {geolocation.error && !searchInput.trim() && (
            <div className="px-4 mb-6">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-100">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-amber-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800">Location unavailable</p>
                    <p className="text-xs text-amber-700 mt-1">{geolocation.error}</p>
                    <button 
                      onClick={geolocation.requestLocation}
                      className="text-xs text-amber-600 hover:text-amber-800 underline mt-1"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search Results */}
          {searchState.query && (
            <div className="px-4">
              <LazyLoad>
                <SearchResults
                  results={searchState.results}
                  isLoading={searchState.isLoading}
                  error={searchState.error}
                  hasSearched={searchState.hasSearched}
                  query={searchState.query}
                  onResultClick={handleResultClick}
                />
              </LazyLoad>
            </div>
          )}
        </div>
      </MobileContent>
    </MobileLayout>
  );
};