/**
 * Discovery domain types
 * Search and cast discovery
 */

export type SortOption = "recommended" | "newest" | "popular" | "nearest";

export interface SearchFilters {
  areaIds?: string[];
  genreIds?: string[];
  minPrice?: number;
  maxPrice?: number;
  availableNow?: boolean;
}

export interface SearchParams {
  query?: string;
  filters?: SearchFilters;
  sort?: SortOption;
  cursor?: string;
  limit?: number;
}

export interface SearchResult {
  castId: string;
  name: string;
  avatarUrl?: string;
  tagline?: string;
  area?: string;
  status: string;
  matchScore?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  nextCursor?: string;
  hasMore: boolean;
  totalCount?: number;
}
