"use client";

import { Badge } from "@/modules/shell/components/ui/badge";
import { Button } from "@/modules/shell/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/shell/components/ui/card";
import { MapPin, Clock, CreditCard, ChevronRight } from "lucide-react";
import React from "react";
import { GuestProfileSheet } from "@/modules/trust/components/GuestProfileSheet";

interface ReservationDetailProps {
  reservationId: string;
}

export const ReservationDetail = ({ reservationId }: ReservationDetailProps) => {

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

      {/* Plan & Time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-500 font-medium">PLAN & TIME</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-indigo-500 mt-0.5" />
            <div>
              <p className="font-bold text-slate-900">{reservation.plan}</p>
              <p className="text-sm text-slate-600">
                {reservation.startAt} - {reservation.endAt}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-500 font-medium">LOCATION</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-rose-500 mt-0.5" />
            <div>
              <p className="font-bold text-slate-900">{reservation.location}</p>
              <p className="text-sm text-slate-600">{reservation.address}</p>
              <Button variant="link" className="px-0 h-auto text-sky-500 text-sm mt-1">
                Open in Maps
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-500 font-medium">PAYMENT</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <CreditCard className="w-5 h-5 text-slate-500 mt-0.5" />
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <p className="font-bold text-slate-900">{reservation.amount}</p>
                <Badge variant="outline" className="text-xs">
                  {reservation.paymentStatus}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                * Estimated amount including options
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
