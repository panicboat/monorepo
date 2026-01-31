/**
 * Ritual Module Types
 *
 * Types for reservation and ritual functionality.
 */

export type RitualStatus = "idle" | "pledging" | "sealed" | "error";

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled";

export interface Reservation {
  id: string;
  guestId: string;
  castId: string;
  planId: string;
  scheduledAt: string;
  duration: number; // minutes
  status: ReservationStatus;
  price: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationDetail extends Reservation {
  guest?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  cast?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  plan?: {
    id: string;
    name: string;
    price: number;
  };
}

export interface WeeklyScheduleSlot {
  date: string; // YYYY-MM-DD
  start: string; // HH:mm
  end: string; // HH:mm
  planId?: string;
  isAvailable: boolean;
}

export interface CreateReservationPayload {
  castId: string;
  planId: string;
  scheduledAt: string;
  notes?: string;
}
