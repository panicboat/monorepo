"use client";

import { useParams, useRouter } from "next/navigation";
import { SideSheet } from "@/components/ui/side-sheet";
import { MessageThread } from "@/modules/messaging/components/MessageThread";

export default function DetailPanel() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  return <SideSheet open onOpenChange={(open) => { if (!open) router.back(); }} title="メッセージ" historyMode="route"><MessageThread key={id} threadId={id} /></SideSheet>;
}
