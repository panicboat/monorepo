import { Badge } from "@/modules/shell/components/ui/Badge";
import { Button } from "@/modules/shell/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/shell/components/ui/Card";
import { MapPin, Clock, CreditCard } from "lucide-react";
import React from "react";

export interface ReservationInfo {
  plan: string;
  startAt: string;
  endAt: string;
  location: string;
  address: string;
  amount: string;
  paymentStatus: string;
}

interface ReservationInfoCardProps {
  info: ReservationInfo;
}

export const ReservationInfoCard = ({ info }: ReservationInfoCardProps) => {
  return (
    <>
      {/* Plan & Time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-500 font-medium">PLAN & TIME</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-indigo-500 mt-0.5" />
            <div>
              <p className="font-bold text-slate-900">{info.plan}</p>
              <p className="text-sm text-slate-600">
                {info.startAt} - {info.endAt}
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
              <p className="font-bold text-slate-900">{info.location}</p>
              <p className="text-sm text-slate-600">{info.address}</p>
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
                <p className="font-bold text-slate-900">{info.amount}</p>
                <Badge variant="outline" className="text-xs">
                  {info.paymentStatus}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                * Estimated amount including options
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
