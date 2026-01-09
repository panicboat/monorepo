"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ChevronRight } from "lucide-react";
import React from "react";
import { GuestProfileSheet } from "@/modules/trust/components/GuestProfileSheet";
import { ReservationInfoCard } from "../ReservationInfoCard";

interface CastReservationDetailProps {
  reservationId: string;
}

export const CastReservationDetail = ({ reservationId }: CastReservationDetailProps) => {

  const [showGuestSheet, setShowGuestSheet] = React.useState(false);

  // TODO: Fetch real data using reservationId
  const reservation = {
    id: reservationId,
    guestName: "Guest User", // This will be linked to GuestProfile later
    guestId: "guest-123",
    status: "confirmed",
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
      {/* Guest Info (CRM Link) */}
      <div onClick={() => setShowGuestSheet(true)} className="cursor-pointer">
        <Card className="hover:bg-slate-50 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-lg font-bold text-pink-500">
                G
              </div>
              <div>
                <p className="font-bold text-slate-900">{reservation.guestName}</p>
                <p className="text-xs text-slate-500">First Visit</p>
              </div>
            </div>
            <Button variant="ghost" size="icon">
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </Button>
          </CardContent>
        </Card>
      </div>
      <GuestProfileSheet
        open={showGuestSheet}
        onOpenChange={setShowGuestSheet}
        guestId={reservation.guestId}
      />

      {/* Shared Info */}
      <ReservationInfoCard info={reservation} />

      {/* Actions */}
      <div className="flex flex-col gap-3 mt-6 pb-8 items-center">
        <Button className="w-full max-w-md h-12 rounded-xl text-base font-bold bg-pink-500 hover:bg-pink-600 text-white shadow-pink-200 shadow-md transition-transform active:scale-95">
          Approve Completion
        </Button>
        <Button variant="outline" className="w-full max-w-md bg-white border-slate-200 text-slate-700 hover:bg-slate-50">
          Contact Guest
        </Button>
        <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 h-auto py-2">
          Cancel Reservation
        </Button>
      </div>
    </div>
  );
};
