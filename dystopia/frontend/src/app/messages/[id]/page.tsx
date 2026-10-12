"use client";

import { useParams } from "next/navigation";
import { MessageThread } from "@/modules/messaging/components/MessageThread";

export default function DetailPage() {
  const { id } = useParams<{ id: string }>();
  return <MessageThread key={id} threadId={typeof id === "string" ? id : ""} />;
}
