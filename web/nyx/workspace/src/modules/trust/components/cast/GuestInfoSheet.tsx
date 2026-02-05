import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import { Badge } from "@/components/ui/Badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Separator } from "@/components/ui/Separator";
import { Copy, Star, History, MessageSquare } from "lucide-react";

interface GuestInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestId?: string;
}

export const GuestInfoSheet = ({
  open,
  onOpenChange,
  guestId,
}: GuestInfoSheetProps) => {
  // TODO: Fetch real data using guestId
  const guest = {
    name: "美玲",
    age: "24",
    job: "経営者",
    visits: 12,
    lastVisit: "2025-12-20",
    trustScore: "A", // S, A, B...
    tags: ["ワイン好き", "静かな会話", "経営"],
    memo: "いつも高価なワインを持参されます。ビジネスの話を好む傾向があり、あまり騒がしい雰囲気は好みません。前回の来店時に赤ワインのグラスを絶賛していました。",
    history: [
      { date: "2025-12-20", cast: "Airi", plan: "Dinner 120min" },
      { date: "2025-11-15", cast: "Yuna", plan: "Standard 60min" },
      { date: "2025-10-01", cast: "Airi", plan: "Standard 90min" },
    ],
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-xl p-0 sm:max-w-md sm:mx-auto font-sans">
        <div className="p-6 h-full flex flex-col">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-center text-text-primary flex items-center justify-center gap-2">
              <Star className="w-4 h-4 text-warning fill-warning" />
              Guest Profile
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            {/* Header Profile */}
            <div className="flex flex-col items-center mb-6">
              <Avatar className="w-24 h-24 mb-4 border-2 border-white shadow-sm ring-2 ring-role-cast-lighter">
                <AvatarImage src={`https://ui-avatars.com/api/?name=${guest.name}&background=random`} />
                <AvatarFallback className="bg-border text-2xl text-text-secondary">G</AvatarFallback>
              </Avatar>
              <h2 className="text-2xl font-bold text-text-primary">{guest.name}</h2>
              <div className="flex items-center gap-2 mt-2 text-sm text-text-secondary">
                <span>{guest.age}歳</span>
                <span>•</span>
                <span>{guest.job}</span>
              </div>
              <div className="flex gap-2 mt-4 flex-wrap justify-center">
                {guest.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="bg-surface-secondary text-text-secondary font-normal border border-border">
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="text-center p-3 bg-surface-secondary rounded-lg border border-border">
                <p className="text-xs text-text-secondary mb-1 font-bold uppercase tracking-wider">Visits</p>
                <p className="text-lg font-bold text-text-primary">{guest.visits}回</p>
              </div>
              <div className="text-center p-3 bg-surface-secondary rounded-lg border border-border">
                <p className="text-xs text-text-secondary mb-1 font-bold uppercase tracking-wider">Trust</p>
                <p className="text-lg font-bold text-emerald-600">{guest.trustScore}</p>
              </div>
              <div className="text-center p-3 bg-surface-secondary rounded-lg border border-border">
                <p className="text-xs text-text-secondary mb-1 font-bold uppercase tracking-wider">Last</p>
                <p className="text-sm font-bold text-text-primary mt-1">{guest.lastVisit}</p>
              </div>
            </div>

            <div className="space-y-8">
              {/* Deep CRM / Notes */}
              <div>
                <h3 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-role-cast" />
                  Deep CRM (Notes)
                </h3>
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-sm text-text-secondary leading-relaxed shadow-sm relative">
                  {/* Note Icon Decoration */}
                  <div className="absolute -top-2 -right-2 bg-amber-100 rounded-full p-1">
                    <Copy className="w-3 h-3 text-amber-500" />
                  </div>
                  {guest.memo}
                </div>
              </div>

              <Separator />

              {/* Interaction History */}
              <div>
                <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                  <History className="w-4 h-4 text-text-muted" />
                  History
                </h3>
                <div className="space-y-4">
                  {guest.history.map((visit, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-border-secondary mt-1.5" />
                        <div>
                          <p className="font-bold text-text-primary">{visit.date}</p>
                          <p className="text-xs text-text-secondary">{visit.plan}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-text-muted block mb-1">Cast</span>
                        <Badge variant="outline" className="font-normal text-text-secondary bg-surface">
                          {visit.cast}
                        </Badge>
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
