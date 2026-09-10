import { FormEvent, useState } from "react";

import type { DisplayLanguage } from "../../shared/meeting.js";

interface ManualCaptionFormProps {
  displayLanguage: DisplayLanguage;
  onSend: (text: string) => boolean;
}

export const submitManualCaption = (
  text: string,
  send: (caption: string) => boolean,
): { sent: boolean; text: string } => {
  const caption = text.trim();
  if (!caption || !send(caption)) return { sent: false, text };
  return { sent: true, text: "" };
};

export const ManualCaptionForm = ({ displayLanguage, onSend }: ManualCaptionFormProps) => {
  const [text, setText] = useState("");
  const [sendUnavailable, setSendUnavailable] = useState(false);
  const japanese = displayLanguage === "ja";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = submitManualCaption(text, onSend);
    setText(result.text);
    setSendUnavailable(!result.sent && text.trim().length > 0);
  };

  return (
    <form className="manual-caption-form" onSubmit={submit}>
      <label htmlFor="manual-caption">{japanese ? "テキストで発話を入力" : "Enter a spoken message"}</label>
      <textarea id="manual-caption" value={text} maxLength={2_000} onChange={(event) => setText(event.target.value)} />
      <button type="submit">{japanese ? "字幕を送信" : "Send caption"}</button>
      {sendUnavailable && (
        <p role="status">
          {japanese ? "接続後にもう一度送信してください。" : "Reconnect, then send this caption again."}
        </p>
      )}
    </form>
  );
};
