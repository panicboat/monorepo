"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ChevronRight, Clock, MapPin, Ticket } from "lucide-react";
import React from "react";
import { GuestInfoSheet } from "@/app/(cast)/manage/concierge/components/GuestInfoSheet";
import { ReservationInfoCard } from "@/modules/ritual/components/ReservationInfoCard";

interface CastReservationDetailProps {
  reservationId: string;
}

export const CastReservationDetail = ({ reservationId }: CastReservationDetailProps) => {
  const [showGuestSheet, setShowGuestSheet] = React.useState(false);

  // TODO: Fetch real data using reservationId
  const reservation = {
    id: reservationId,
    guestName: "美玲",
    guestId: "guest-123",
    status: "inviting", // inviting | sealed | cancelled
    plan: "90分 VIPコース",
    startAt: "2026-01-10 19:00",
    endAt: "2026-01-10 20:30",
    location: "Club VENUS",
    address: "歌舞伎町 1-2-3",
    amount: "¥35,000",
    option: "指名料込み",
    paymentStatus: "Unauthorized",
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Guest Info (Concierge Link) */}
      <div onClick={() => setShowGuestSheet(true)} className="cursor-pointer">
        <Card className="active:bg-slate-50 transition-colors border-pink-100 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden border border-white shadow-sm">
                <img src={`https://ui-avatars.com/api/?name=${reservation.guestName}&background=random`} alt={reservation.guestName} className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="font-bold text-slate-900 flex items-center gap-2">
                  {reservation.guestName}
                </p>
                <div className="flex gap-2 mt-0.5">
                  <p className="text-xs text-slate-400">First Visit</p>
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300" />
          </CardContent>
        </Card>
      </div>

      <GuestInfoSheet
        open={showGuestSheet}
        onOpenChange={setShowGuestSheet}
        guestId={reservation.guestId}
      />

      {/* Shared Info */}
      <ReservationInfoCard info={reservation} />

      {/* Actions */}
      <div className="flex flex-col gap-3 mt-4 pb-8 items-center">
        {reservation.status === 'inviting' ? (
          <Button variant="ghost" className="w-full text-slate-500 hover:bg-transparent hover:text-slate-500 active:bg-slate-100 transition-colors">
            招待を取り消す (Cancel)
          </Button>
        ) : (
          <Button variant="ghost" className="w-full text-red-500 hover:bg-transparent hover:text-red-500 active:bg-red-50 transition-colors">
            予約をキャンセル (Cancel)
          </Button>
        )}
      </div>
    </div>
  );
};
