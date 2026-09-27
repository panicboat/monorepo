export type MediaType = "image" | "video";

export type Media = {
  id?: string;
  mediaId?: string;
  mediaType: MediaType;
  url: string;
  thumbnailUrl?: string;
};

export type SaveMediaInput = {
  mediaType: MediaType;
  mediaId: string;
};

export type MediaWithKey = Media & {
  key?: string;
};

export type UserType = "guest" | "cast";

export type Author = {
  id: string;
  name: string;
  imageUrl: string;
};

export type AuthorWithType = Author & {
  userType: UserType;
};

export type PaginatedResponse<T> = {
  items: T[];
  nextCursor: string;
  hasMore: boolean;
};

export type PaginationParams = {
  cursor?: string;
  limit?: number;
};

export type ApiError = {
  message: string;
  status?: number;
  code?: string;
};

export type MutationResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type Role = "guest" | "cast";
export type RoleNumber = 0 | 1;

export function roleToNumber(role: Role): RoleNumber {
  return role === "guest" ? 1 : 0;
}

export function numberToRole(num: RoleNumber | number): Role {
  return num === 1 ? "guest" : "cast";
}
