export type SpeechLanguage = "ja-JP" | "en-US";

export type DisplayLanguage = "ja" | "en";

export interface Participant {
  id: string;
  displayName: string;
  speechLanguage: SpeechLanguage;
  displayLanguage: DisplayLanguage;
}

export interface Caption {
  id: string;
  sequence: number;
  speaker: Participant;
  sourceLanguage: SpeechLanguage;
  sourceText: string;
  translatedText?: string;
  kind: "speech" | "manual";
  state: "translating" | "final" | "failed";
  createdAt: number;
}

export type ClientMessage =
  | {
      type: "join";
      roomId: string;
      token: string;
      displayName: string;
      speechLanguage: SpeechLanguage;
      displayLanguage: DisplayLanguage;
      consent: true;
    }
  | { type: "audio:start" }
  | { type: "audio:stop" }
  | { type: "caption:manual"; text: string }
  | { type: "clarification:request"; captionId: string }
  | { type: "leave" };

export type ServerMessage =
  | { type: "room:joined"; participantId: string; participants: Participant[] }
  | { type: "participant:joined" | "participant:left"; participant: Participant }
  | { type: "caption:preview"; speakerId: string; sourceText: string }
  | { type: "caption:pending" | "caption:final" | "caption:failed"; caption: Caption }
  | { type: "clarification:requested"; captionId: string; requester: Participant }
  | {
      type: "status";
      code:
        | "invalid_message"
        | "room_full"
        | "room_not_found"
        | "microphone_unavailable"
        | "recognition_unavailable"
        | "translation_unavailable"
        | "reconnecting";
    };
