"use client";

import React from "react";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { InvitationCard } from "@feature/invitation";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'sticker' | 'invitation';
  timestamp: string;
}

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  onInteract?: (type: string, payload?: unknown) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isMe, onInteract }) => {
  if (message.type === 'invitation') {
    return (
      <div className={cn("flex gap-3", isMe ? "flex-row-reverse" : "flex-row")}>
        {!isMe && (
          <div className="w-8 h-8 rounded-full bg-slate-700 bg-cover cursor-pointer hover:opacity-80 transition shrink-0"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop')" }} />
        )}
        <div className="max-w-[85%]">
          <InvitationCard onClick={() => onInteract && onInteract('invitation')} />
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex gap-3", isMe ? "flex-row-reverse" : "flex-row")}>
      {isMe ? (
        <div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center text-xs text-white shrink-0">T</div>
      ) : (
        <div className="w-8 h-8 rounded-full bg-slate-700 bg-cover cursor-pointer hover:opacity-80 transition shrink-0"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop')" }} />
      )}

      <div className={cn(
        "p-3 text-sm max-w-[80%] rounded-2xl",
        isMe ? "bg-blue-900/30 border border-blue-800/30 text-blue-100 rounded-tr-none"
          : "bg-slate-800 text-slate-200 rounded-tl-none"
      )}>
        {message.content.split('\n').map((line, i) => (
          <React.Fragment key={i}>
            {line}
            {i < message.content.split('\n').length - 1 && <br />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
