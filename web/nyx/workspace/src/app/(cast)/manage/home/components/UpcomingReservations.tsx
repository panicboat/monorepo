import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { Clock } from "lucide-react";
import Link from "next/link";

interface Reservation {
  id: string;
  guestName: string;
  date: string;
  startTime: string;
  planName: string;
  status: string;
  duration: number;
  guestIcon: string;
}

interface UpcomingReservationsProps {
  reservations: Reservation[];
}

export const UpcomingReservations = ({
  reservations,
}: UpcomingReservationsProps) => {
  if (reservations.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 bg-white rounded-xl shadow-sm border border-slate-100">
        <p className="text-sm">これからの予定はありません</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          直近の予定
        </h2>
      </div>

      <div className="divide-y divide-slate-100">
        {reservations.map((reservation, index) => (
          <Link
            key={reservation.id}
            href={`/manage/pledges/${reservation.id}`}
            className="block hover:bg-slate-50 transition-colors"
          >
            <div className="p-4 flex items-center gap-4">
              <div className="relative">
                {index === 0 && (
                  <div className="absolute -inset-1 rounded-full border-2 border-pink-500 animate-pulse" />
                )}
                <Avatar className="relative w-12 h-12 border border-slate-100">
                  <AvatarImage src={reservation.guestIcon} alt={reservation.guestName} className="object-cover" />
                  <AvatarFallback className="bg-slate-200">G</AvatarFallback>
                </Avatar>
              </div>

              <div className="flex-1 flex justify-between items-start">
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-3 mb-1">
                    <span className="text-xl font-bold font-serif text-slate-900 tracking-tight">
                      {reservation.startTime}
                    </span>
                    <span className="text-sm font-bold text-slate-700">
                      {reservation.guestName}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 font-medium">
                    {reservation.planName}
                  </div>
                </div>

                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  {reservation.duration}min
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
