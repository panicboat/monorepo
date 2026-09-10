import { useState } from "react";

import { EntryForm } from "./components/entry-form.js";
import { MeetingView } from "./components/meeting-view.js";
import { type MeetingJoinDetails, useMeetingSocket } from "./hooks/use-meeting-socket.js";

const roomDetailsFromLocation = (): Pick<MeetingJoinDetails, "roomId" | "token"> | undefined => {
  const match = window.location.pathname.match(/^\/translate\/rooms\/([^/]+)$/);
  const token = window.location.hash.slice(1);
  if (!match || !token) return undefined;
  return { roomId: decodeURIComponent(match[1]), token };
};

const MeetingSession = ({ join }: { join: MeetingJoinDetails }) => {
  const socket = useMeetingSocket(join);
  return <MeetingView displayLanguage={join.displayLanguage} socket={socket} />;
};

export const App = () => {
  const [join, setJoin] = useState<MeetingJoinDetails>();
  const roomDetails = roomDetailsFromLocation();

  if (join) return <MeetingSession join={join} />;
  return <EntryForm initialRoomId={roomDetails?.roomId} initialToken={roomDetails?.token} onJoin={setJoin} />;
};
