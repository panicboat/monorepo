"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Circle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

type ChatPreview = {
  id: string; // Cast ID for routing
  castName: string;
  castImage: string;
  lastMessage: string;
  time: string;
  unreadCount: number;
  isOnline: boolean;
};

const MOCK_CHATS: ChatPreview[] = [
  {
    id: "1",
    castName: "Yuna",
    castImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Yuna",
    lastMessage: "Thank you for the pledge! 💖",
    time: "10m",
    unreadCount: 1,
    isOnline: true,
  },
  {
    id: "2",
    castName: "Maria",
    castImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria",
    lastMessage: "Are you free tonight?",
    time: "2h",
    unreadCount: 0,
    isOnline: false,
  },
  {
    id: "3",
    castName: "Sarah",
    castImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    lastMessage: "See you next week! 👋",
    time: "1d",
    unreadCount: 0,
    isOnline: false,
  },
];

export const ChatList = () => {
  return (
    <div className="pb-24 pt-4">
      {/* Title handled by global header */}
      <div className="space-y-1">
        {MOCK_CHATS.map((chat) => (
          <Link href={`/concierge/${chat.id}`} key={chat.id}>
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              whileTap={{ backgroundColor: "rgba(0,0,0,0.02)" }}
              className="flex items-center gap-4 bg-surface px-4 py-4 transition-colors hover:bg-surface-secondary"
            >
              <div className="relative">
                <Avatar className="h-14 w-14 border border-border">
                  <AvatarImage src={chat.castImage} alt={chat.castName} className="object-cover" />
                  <AvatarFallback>C</AvatarFallback>
                </Avatar>
                {chat.isOnline && (
                  <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-surface bg-success"></span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-text-primary truncate">
                    {chat.castName}
                  </h3>
                  <span className="text-xs text-text-muted flex-shrink-0">
                    {chat.time}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p
                    className={`text-sm truncate ${chat.unreadCount > 0 ? "text-text-primary font-medium" : "text-text-secondary"}`}
                  >
                    {chat.lastMessage}
                  </p>
                  {chat.unreadCount > 0 && (
                    <Badge className="ml-2 h-5 min-w-[1.25rem] flex items-center justify-center rounded-full bg-role-guest px-1 text-[10px] font-bold text-white border-none">
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
};
