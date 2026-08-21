"use client";

import { MessagingStreamProvider } from "@/modules/messaging";

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return <MessagingStreamProvider>{children}</MessagingStreamProvider>;
}
