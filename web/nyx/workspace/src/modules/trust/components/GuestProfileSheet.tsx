import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/modules/shell/components/ui/Sheet";
import { Badge } from "@/modules/shell/components/ui/Badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/modules/shell/components/ui/Avatar";
import { ScrollArea } from "@/modules/shell/components/ui/ScrollArea";
import { Separator } from "@/modules/shell/components/ui/Separator";

interface GuestProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestId?: string;
}

export const GuestProfileSheet = ({
  open,
  onOpenChange,
  guestId,
}: GuestProfileSheetProps) => {
  // TODO: Fetch real data using guestId
  const guest = {
    name: "Guest User",
    age: "30s",
    job: "IT Executive",
    visits: 12,
    lastVisit: "2025-12-20",
    trustScore: "A", // S, A, B...
    tags: ["Gentleman", "Rich", "Wine Lover"],
    memo: "Always brings expensive wine. Prefers quiet conversation.",
    history: [
      { date: "2025-12-20", cast: "Airi", plan: "Dinner 120min" },
      { date: "2025-11-15", cast: "Yuna", plan: "Standard 60min" },
      { date: "2025-10-01", cast: "Airi", plan: "Standard 90min" },
    ],
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-xl p-0 sm:max-w-md sm:mx-auto">
        <div className="p-6 h-full flex flex-col">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-center text-slate-900">Guest Profile</SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="flex flex-col items-center mb-6">
              <Avatar className="w-24 h-24 mb-4 border-2 border-white shadow-sm">
                <AvatarImage src="" /> {/* TODO: Placeholder or real image */}
                <AvatarFallback className="bg-slate-200 text-2xl text-slate-500">G</AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-bold text-slate-900">{guest.name}</h2>
              <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                <span>{guest.age}</span>
                <span>•</span>
                <span>{guest.job}</span>
              </div>
              <div className="flex gap-2 mt-4">
                {guest.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="bg-slate-100 text-slate-600 font-normal">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Visits</p>
                <p className="text-lg font-bold text-slate-900">{guest.visits}</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Trust</p>
                <p className="text-lg font-bold text-emerald-600">{guest.trustScore}</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Last</p>
                <p className="text-sm font-bold text-slate-900 mt-1">{guest.lastVisit}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">Private Memo (CRM)</h3>
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 text-sm text-slate-700 leading-relaxed">
                  {guest.memo}
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3">History</h3>
                <div className="space-y-3">
                  {guest.history.map((visit, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-slate-300" />
                        <span className="font-medium text-slate-900">{visit.date}</span>
                      </div>
                      <div className="flex items-center gap-4 text-slate-500">
                        <span>{visit.cast}</span>
                        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{visit.plan}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="h-12" /> {/* Bottom Spacer */}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
};
