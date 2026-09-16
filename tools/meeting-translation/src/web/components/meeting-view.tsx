import type { DisplayLanguage } from "../../shared/meeting.js";
import type { MeetingJoinDetails, MeetingSocket } from "../hooks/use-meeting-socket.js";
import { useMicrophone } from "../hooks/use-microphone.js";
import { clarificationRequestCopy } from "../lib/clarification-copy.js";
import { toPcm16 } from "../lib/pcm.js";
import { serverStatusCopy } from "../lib/status-copy.js";
import { CaptionList } from "./caption-list.js";
import { ManualCaptionForm } from "./manual-caption-form.js";

interface MeetingViewProps {
  displayLanguage: DisplayLanguage;
  socket: MeetingSocket;
}

const statusCopy = {
  ja: {
    active: "マイクを停止",
    idle: "マイクを開始",
    microphoneUnavailable: "マイクを使用できません。テキスト入力をご利用ください。",
    reconnect: "再接続",
    reconnecting: "再接続しています…",
    socketClosed: "接続が終了しました。",
  },
  en: {
    active: "Stop microphone",
    idle: "Start microphone",
    microphoneUnavailable: "Microphone is unavailable. Use text input instead.",
    reconnect: "Reconnect",
    reconnecting: "Reconnecting…",
    socketClosed: "Connection closed.",
  },
};

export const MeetingView = ({ displayLanguage, socket }: MeetingViewProps) => {
  const text = statusCopy[displayLanguage];
  const microphone = useMicrophone({
    onAudioStart: socket.startAudio,
    onAudioStop: socket.stopAudio,
    onFrame: (frame) => socket.sendAudio(toPcm16(frame)),
  });

  return (
    <main className="meeting-page">
      <header>
        <h1>{displayLanguage === "ja" ? "ライブ会議翻訳" : "Live meeting translation"}</h1>
        <p>{displayLanguage === "ja" ? "音声はリアルタイムで字幕と翻訳に処理されます。" : "Audio is processed for live captions and translation."}</p>
      </header>
      <section aria-label={displayLanguage === "ja" ? "参加者" : "Participants"}>
        <h2>{displayLanguage === "ja" ? "参加者" : "Participants"}</h2>
        <ul>{socket.participants.map((participant) => <li key={participant.id}>{participant.displayName}</li>)}</ul>
      </section>
      <section className="meeting-controls" aria-label={displayLanguage === "ja" ? "会議コントロール" : "Meeting controls"}>
        <button type="button" onClick={() => void (microphone.status === "active" ? microphone.stop() : microphone.start())} disabled={microphone.status === "starting"}>
          {microphone.status === "active" ? text.active : text.idle}
        </button>
        {microphone.status === "microphone_unavailable" && <p role="alert">{text.microphoneUnavailable}</p>}
        {socket.status === "reconnecting" && <p role="status">{text.reconnecting}</p>}
        {socket.status === "manual_reconnect" && <button type="button" onClick={socket.reconnect}>{text.reconnect}</button>}
        {socket.status === "closed" && <p role="alert">{text.socketClosed}</p>}
        {socket.serverStatus && <p role="status">{serverStatusCopy(socket.serverStatus, displayLanguage)}</p>}
      </section>
      <section>
        <h2>{displayLanguage === "ja" ? "字幕" : "Captions"}</h2>
        {socket.clarificationRequest && (
          <p role="status">
            {clarificationRequestCopy(socket.clarificationRequest, displayLanguage)}
          </p>
        )}
        <CaptionList captions={socket.captions} displayLanguage={displayLanguage} onClarification={(captionId) => socket.send({ type: "clarification:request", captionId })} />
      </section>
      <ManualCaptionForm displayLanguage={displayLanguage} onSend={(text) => socket.send({ type: "caption:manual", text })} />
    </main>
  );
};
