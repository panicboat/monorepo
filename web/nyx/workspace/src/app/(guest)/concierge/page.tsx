import { ChatList } from "@/modules/concierge/components/ChatList";

// Ensure this page is only accessible when logged in (LoginGate handles it at root layout/page level effectively,
// but for separate routes we might need a protect layout or HOC.
// For this mock, relying on the fact that nav is hidden if not logged in is "soft" protection,
// but ideally we check auth here too. We'll skip complex auth guards for mock.)

export default function ConciergePage() {
  return (
    <div className="bg-white">
      <ChatList />
    </div>
  );
}
