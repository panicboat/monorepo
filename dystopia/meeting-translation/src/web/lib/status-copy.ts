import type { DisplayLanguage, ServerMessage } from "../../shared/meeting.js";

type StatusCode = Extract<ServerMessage, { type: "status" }>["code"];

const statusCopy: Record<DisplayLanguage, Record<StatusCode, string>> = {
  ja: {
    invalid_message: "受信したメッセージを処理できませんでした。",
    room_full: "会議の参加人数が上限に達しています。",
    room_not_found: "会議が見つからないか、招待リンクが無効です。",
    microphone_unavailable: "マイクを使用できません。テキスト入力をご利用ください。",
    recognition_unavailable: "音声認識を利用できません。テキスト入力をご利用ください。",
    translation_unavailable: "翻訳を利用できません。原文を表示します。",
    reconnecting: "接続を復旧しています…",
  },
  en: {
    invalid_message: "The received message could not be processed.",
    room_full: "The meeting has reached its participant limit.",
    room_not_found: "The meeting was not found or the invitation link is invalid.",
    microphone_unavailable: "Microphone is unavailable. Use text input instead.",
    recognition_unavailable: "Speech recognition is unavailable. Use text input instead.",
    translation_unavailable: "Translation is unavailable. The source text is shown.",
    reconnecting: "Restoring the connection…",
  },
};

const unknownStatusCopy: Record<DisplayLanguage, string> = {
  ja: "問題が発生しました。もう一度お試しください。",
  en: "Something went wrong. Please try again.",
};

export const serverStatusCopy = (code: StatusCode, language: DisplayLanguage): string =>
  statusCopy[language][code] ?? unknownStatusCopy[language];
