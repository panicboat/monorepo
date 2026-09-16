import { FormEvent, useState } from "react";

import type { DisplayLanguage, SpeechLanguage } from "../../shared/meeting.js";
import { createRoomLink } from "../lib/room-link.js";
import type { MeetingJoinDetails } from "../hooks/use-meeting-socket.js";

interface EntryFormProps {
  initialRoomId?: string;
  initialToken?: string;
  onJoin: (details: MeetingJoinDetails) => void;
}

interface CreatedRoom {
  roomId: string;
  token: string;
  link: string;
}

const languageNames: Record<DisplayLanguage, { consent: string; create: string; display: string; name: string; speech: string }> = {
  ja: {
    consent: "音声と字幕を外部サービスの Amazon Transcribe と Amazon Bedrock に送信し、文字起こしと翻訳のために処理することに同意します。",
    create: "会議を作成",
    display: "表示言語",
    name: "表示名",
    speech: "話す言語",
  },
  en: {
    consent: "I consent to sending audio and captions to the external services Amazon Transcribe and Amazon Bedrock for transcription and translation processing.",
    create: "Create meeting",
    display: "Display language",
    name: "Display name",
    speech: "Spoken language",
  },
};

export const EntryForm = ({ initialRoomId, initialToken, onJoin }: EntryFormProps) => {
  const [displayName, setDisplayName] = useState("");
  const [speechLanguage, setSpeechLanguage] = useState<SpeechLanguage>("ja-JP");
  const [displayLanguage, setDisplayLanguage] = useState<DisplayLanguage>("ja");
  const [consent, setConsent] = useState(false);
  const [createdRoom, setCreatedRoom] = useState<CreatedRoom>();
  const [error, setError] = useState<string>();
  const [isCreating, setIsCreating] = useState(false);
  const [copyState, setCopyState] = useState<"copied" | "unavailable">();
  const text = languageNames[displayLanguage];
  const roomId = initialRoomId ?? createdRoom?.roomId;
  const token = initialToken ?? createdRoom?.token;
  const canJoin = displayName.trim().length > 0 && consent && Boolean(roomId && token);
  const canCreate = displayName.trim().length > 0 && consent && !isCreating;

  const join = () => {
    if (!roomId || !token || !canJoin) return;
    onJoin({ roomId, token, displayName: displayName.trim(), speechLanguage, displayLanguage });
  };

  const create = async () => {
    setError(undefined);
    setCopyState(undefined);
    setIsCreating(true);
    try {
      const response = await fetch("/translate/api/rooms", { method: "POST" });
      if (!response.ok) throw new Error("room_creation_failed");
      const result = await response.json() as { roomId?: unknown; joinToken?: unknown };
      if (typeof result.roomId !== "string" || typeof result.joinToken !== "string") {
        throw new Error("room_creation_failed");
      }
      const link = createRoomLink(window.location.origin, result.roomId, result.joinToken);
      setCreatedRoom({ roomId: result.roomId, token: result.joinToken, link });
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(link);
          setCopyState("copied");
        } catch {
          // FALLBACK: the selectable room link remains available when clipboard access is denied.
          setCopyState("unavailable");
        }
      } else {
        setCopyState("unavailable");
      }
    } catch {
      setError(displayLanguage === "ja" ? "会議を作成できませんでした。" : "Unable to create the meeting.");
    } finally {
      setIsCreating(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (roomId && token) join();
    else if (canCreate) void create();
  };

  return (
    <main className="entry-page">
      <form className="entry-form" onSubmit={submit}>
        <h1>{displayLanguage === "ja" ? "ライブ会議翻訳" : "Live meeting translation"}</h1>
        <label htmlFor="display-name">{text.name}</label>
        <input id="display-name" value={displayName} maxLength={40} required onChange={(event) => setDisplayName(event.target.value)} />
        <label htmlFor="speech-language">{text.speech}</label>
        <select id="speech-language" value={speechLanguage} onChange={(event) => setSpeechLanguage(event.target.value as SpeechLanguage)}>
          <option value="ja-JP">日本語</option>
          <option value="en-US">English</option>
        </select>
        <label htmlFor="display-language">{text.display}</label>
        <select id="display-language" value={displayLanguage} onChange={(event) => setDisplayLanguage(event.target.value as DisplayLanguage)}>
          <option value="ja">日本語</option>
          <option value="en">English</option>
        </select>
        <label className="consent" htmlFor="consent">
          <input id="consent" type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          {text.consent}
        </label>
        {initialRoomId && initialToken ? (
          <button type="submit" disabled={!canJoin}>{displayLanguage === "ja" ? "会議に参加" : "Join meeting"}</button>
        ) : (
          <button type="submit" disabled={!canCreate}>{isCreating ? (displayLanguage === "ja" ? "作成中…" : "Creating…") : text.create}</button>
        )}
        {createdRoom && (
          <section aria-live="polite">
            <p>{copyState === "copied" ? (displayLanguage === "ja" ? "招待リンクをコピーしました。" : "Invitation link copied.") : (displayLanguage === "ja" ? "招待リンクを選択してコピーしてください。" : "Select and copy this invitation link.")}</p>
            <label htmlFor="room-link">{displayLanguage === "ja" ? "招待リンク" : "Invitation link"}</label>
            <input id="room-link" readOnly value={createdRoom.link} onFocus={(event) => event.currentTarget.select()} />
            <button type="button" disabled={!canJoin} onClick={join}>{displayLanguage === "ja" ? "会議に参加" : "Join meeting"}</button>
          </section>
        )}
        {error && <p role="alert">{error}</p>}
      </form>
    </main>
  );
};
