import type { Item, Store } from './index';

export interface SearchResult extends Item {
  store: Store;
  distance?: number; // Distance in kilometers
}

export interface SearchState {
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
  hasSearched: boolean;
}