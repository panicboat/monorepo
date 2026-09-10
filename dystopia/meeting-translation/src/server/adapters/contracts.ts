import type { Caption, Participant, ServerMessage, SpeechLanguage } from "../../shared/meeting.js";

export interface TranslationRequest {
  sourceText: string;
  sourceLanguage: SpeechLanguage;
  targetLanguage: SpeechLanguage;
  context: readonly Caption[];
  glossary: readonly string[];
}

export interface TranslationOptions {
  signal: AbortSignal;
}

export interface Translator {
  translate(request: TranslationRequest, options: TranslationOptions): Promise<string>;
}

export interface RecognitionSession {
  write(chunk: Uint8Array): void;
  stop(): Promise<void>;
}

export interface RecognitionOptions {
  language: SpeechLanguage;
  onPartial(text: string): void;
  onFinal(text: string): void;
  onError(code: "recognition_unavailable"): void;
  onReconnected?(): void;
  onReconnecting?(): void;
}

export interface SpeechRecognizer {
  start(options: RecognitionOptions): Promise<RecognitionSession>;
}

export interface RoomConnection {
  send(message: ServerMessage): void;
}

export interface CreatedRoom {
  roomId: string;
  joinToken: string;
}

export type JoinResult =
  | { ok: true; participant: Participant }
  | { ok: false; code: "invalid_message" | "room_full" | "room_not_found" };
