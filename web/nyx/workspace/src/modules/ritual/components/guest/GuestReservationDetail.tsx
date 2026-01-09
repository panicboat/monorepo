"use client";

import { Button } from "@/components/ui/Button";
import React from "react";
import { ReservationInfoCard } from "../ReservationInfoCard";

interface GuestReservationDetailProps {
  reservationId: string;
}

export const GuestReservationDetail = ({ reservationId }: GuestReservationDetailProps) => {
  // TODO: Fetch real data using reservationId
  const reservation = {
    plan: "Standard 60min",
    startAt: "2026-01-10 19:00",
    endAt: "2026-01-10 20:00",
    location: "Hotel Mets Shibuya",
    address: "3-chōme-29-17 Shibuya, Tokyo",
    amount: "¥15,000",
    paymentStatus: "Unauthorized",
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Shared Info */}
      <ReservationInfoCard info={reservation} />

      {/* Actions */}
      <div className="flex flex-col gap-3 mt-6 pb-8 items-center">
        <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 h-auto py-2">
          Cancel Reservation
        </Button>
      </div>
    </div>
  );
};
