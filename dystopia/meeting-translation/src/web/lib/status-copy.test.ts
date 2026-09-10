import { describe, expect, it } from "vitest";

import type { ServerMessage } from "../../shared/meeting.js";
import { serverStatusCopy } from "./status-copy.js";

type StatusCode = Extract<ServerMessage, { type: "status" }>["code"];

describe("serverStatusCopy", () => {
  it.each<[StatusCode, string, string]>([
    ["invalid_message", "受信したメッセージを処理できませんでした。", "The received message could not be processed."],
    ["room_full", "会議の参加人数が上限に達しています。", "The meeting has reached its participant limit."],
    ["room_not_found", "会議が見つからないか、招待リンクが無効です。", "The meeting was not found or the invitation link is invalid."],
    ["microphone_unavailable", "マイクを使用できません。テキスト入力をご利用ください。", "Microphone is unavailable. Use text input instead."],
    ["recognition_unavailable", "音声認識を利用できません。テキスト入力をご利用ください。", "Speech recognition is unavailable. Use text input instead."],
    ["translation_unavailable", "翻訳を利用できません。原文を表示します。", "Translation is unavailable. The source text is shown."],
    ["reconnecting", "接続を復旧しています…", "Restoring the connection…"],
  ])("maps %s to fixed Japanese and English copy", (code, japanese, english) => {
    expect(serverStatusCopy(code, "ja")).toBe(japanese);
    expect(serverStatusCopy(code, "en")).toBe(english);
  });

  it("does not disclose an unknown internal code", () => {
    expect(serverStatusCopy("private_provider_failure" as StatusCode, "ja")).toBe(
      "問題が発生しました。もう一度お試しください。",
    );
    expect(serverStatusCopy("private_provider_failure" as StatusCode, "en")).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
