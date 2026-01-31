/**
 * Identity domain types
 * Authentication, authorization, and user identity
 */

export type UserRole = "ROLE_GUEST" | "ROLE_CAST" | 1 | 2;

export interface User {
  id: string;
  name: string;
  avatarUrl?: string;
  isGuest: boolean;
  role: UserRole;
  isNew?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  phoneNumber: string;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  userProfile: UserProfile;
}

export interface VerificationResponse {
  verificationToken: string;
}
