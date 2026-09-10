import { FormEvent, useState } from "react";

import type { DisplayLanguage } from "../../shared/meeting.js";

interface ManualCaptionFormProps {
  displayLanguage: DisplayLanguage;
  onSend: (text: string) => void;
}

export const ManualCaptionForm = ({ displayLanguage, onSend }: ManualCaptionFormProps) => {
  const [text, setText] = useState("");
  const japanese = displayLanguage === "ja";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const caption = text.trim();
    if (!caption) return;
    onSend(caption);
    setText("");
  };

  return (
    <form className="manual-caption-form" onSubmit={submit}>
      <label htmlFor="manual-caption">{japanese ? "テキストで発話を入力" : "Enter a spoken message"}</label>
      <textarea id="manual-caption" value={text} maxLength={2_000} onChange={(event) => setText(event.target.value)} />
      <button type="submit">{japanese ? "字幕を送信" : "Send caption"}</button>
    </form>
  );
};
