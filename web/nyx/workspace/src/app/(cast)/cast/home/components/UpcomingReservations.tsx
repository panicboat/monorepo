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
      <div className="text-center py-8 text-text-muted bg-surface rounded-xl shadow-sm border border-border">
        <p className="text-sm">これからの予定はありません</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden">
      <div className="p-4 border-b border-border bg-surface-secondary/50">
        <h2 className="font-semibold text-text-primary flex items-center gap-2">
          <Clock className="w-4 h-4 text-text-secondary" />
          直近の予定
        </h2>
      </div>

      <div className="divide-y divide-border">
        {reservations.map((reservation, index) => (
          <Link
            key={reservation.id}
            href={`/cast/pledges/${reservation.id}`}
            className="block hover:bg-surface-secondary transition-colors"
          >
            <div className="p-4 flex items-center gap-4">
              <div className="relative">
                {index === 0 && (
                  <div className="absolute -inset-1 rounded-full border-2 border-role-cast animate-pulse" />
                )}
                <Avatar className="relative w-12 h-12 border border-border">
                  <AvatarImage src={reservation.guestIcon} alt={reservation.guestName} className="object-cover" />
                  <AvatarFallback className="bg-border">G</AvatarFallback>
                </Avatar>
              </div>

              <div className="flex-1 flex justify-between items-start">
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-3 mb-1">
                    <span className="text-xl font-bold font-serif text-text-primary tracking-tight">
                      {reservation.startTime}
                    </span>
                    <span className="text-sm font-bold text-text-secondary">
                      {reservation.guestName}
                    </span>
                  </div>

                  <div className="text-xs text-text-secondary font-medium">
                    {reservation.planName}
                  </div>
                </div>

                <span className="text-[10px] font-bold text-text-secondary bg-surface-secondary px-1.5 py-0.5 rounded border border-border">
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
