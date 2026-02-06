"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

// Mock data for Guests whom the Cast is chatting with
const MOCK_GUEST_CHATS = [
  {
    id: "1",
    name: "Takuya",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Takuya",
    lastMessage: "Thank you! I'll be there.",
    time: "10:35",
    unreadCount: 0,
    isOnline: true,
  },
  {
    id: "2",
    name: "Kenji",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kenji",
    lastMessage: "Can I change the plan?",
    time: "Yesterday",
    unreadCount: 3,
    isOnline: false,
  },
  {
    id: "3",
    name: "Sato",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sato",
    lastMessage: "Looking forward to it.",
    time: "2d ago",
    unreadCount: 0,
    isOnline: false,
  },
];

export default function ConciergeListPage() {
  return (
    <div className="bg-surface-secondary min-h-screen pb-20">
      <div className="space-y-px bg-border border-t border-border">
        {MOCK_GUEST_CHATS.map((chat) => (
          <Link href={`/cast/concierge/${chat.id}`} key={chat.id}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-4 bg-surface px-4 py-4 hover:bg-surface-secondary transition-colors"
            >
              <div className="relative">
                <Avatar className="h-14 w-14 border border-border">
                  <AvatarImage src={chat.image} alt={chat.name} />
                  <AvatarFallback>{chat.name[0]}</AvatarFallback>
                </Avatar>
                {chat.isOnline && (
                  <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-success"></span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-text-primary truncate">
                    {chat.name}
                  </h3>
                  <span className="text-xs text-text-muted flex-shrink-0">
                    {chat.time}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p
                    className={`text-sm truncate ${chat.unreadCount > 0 ? "text-text-primary font-bold" : "text-text-secondary"
                      }`}
                  >
                    {chat.lastMessage}
                  </p>
                  {chat.unreadCount > 0 && (
                    <Badge className="ml-2 h-5 min-w-[1.25rem] flex items-center justify-center rounded-full bg-role-cast px-1 text-[10px] font-bold text-white border-none shadow-sm shadow-role-cast-shadow">
                      {chat.unreadCount}
                    </Badge>
                  )}
                </div>
              </div>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );
}
