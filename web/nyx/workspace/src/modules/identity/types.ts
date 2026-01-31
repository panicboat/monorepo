/**
 * Identity Module Types
 *
 * Types for authentication and user identity.
 */

export type Role = "guest" | "cast";

export interface User {
  id: string;
  name: string;
  avatarUrl?: string;
  isGuest: boolean;
  role: number | string;
  isNew?: boolean;
}

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  role: Role | null;
  userId: string | null;
}

export interface LoginCredentials {
  phoneNumber: string;
  password: string;
  role?: number;
}

export interface RegisterCredentials {
  phoneNumber: string;
  password: string;
  verificationToken: string;
  role?: number;
}

export interface VerificationResult {
  verificationToken: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  userProfile: {
    id: string;
    phoneNumber: string;
    role: number | string;
  };
}
