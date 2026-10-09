"use client";

import { MessagingPollingProvider } from "@/modules/messaging";

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return <MessagingPollingProvider>{children}</MessagingPollingProvider>;
}
