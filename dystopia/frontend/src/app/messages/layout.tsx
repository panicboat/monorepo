"use client";

import { MessagingPollingProvider } from "@/modules/messaging";

export default function MessagesLayout({ children, thread }: { children: React.ReactNode; thread: React.ReactNode }) {
  return <MessagingPollingProvider>{children}{thread}</MessagingPollingProvider>;
}
