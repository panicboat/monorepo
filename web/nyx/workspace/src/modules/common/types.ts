/**
 * Common domain types
 * Shared UI components and utilities
 */

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface MediaModalProps extends ModalProps {
  mediaUrl: string;
  mediaType: "image" | "video";
  alt?: string;
}

export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}
