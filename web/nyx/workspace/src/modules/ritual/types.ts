/**
 * Ritual domain types
 * Reservations and scheduling
 */

export type RitualStatus = "idle" | "pledging" | "sealed" | "error";

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled";

export interface TimeSlot {
  start: string; // HH:mm
  end: string; // HH:mm
}

export interface Reservation {
  id: string;
  castId: string;
  guestId: string;
  planId: string;
  date: string; // YYYY-MM-DD
  timeSlot: TimeSlot;
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationRequest {
  castId: string;
  planId: string;
  date: string;
  timeSlot: TimeSlot;
  message?: string;
}
