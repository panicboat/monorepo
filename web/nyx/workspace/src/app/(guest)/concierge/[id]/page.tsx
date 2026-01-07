import { use } from "react";
import { ChatRoom } from "@/modules/concierge/components/guest/ChatRoom";

export default function ChatRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="bg-white">
      <ChatRoom castId={id} />
    </div>
  );
}
