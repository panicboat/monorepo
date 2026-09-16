import type { Caption, DisplayLanguage } from "../../shared/meeting.js";
import { primaryCaptionText } from "../lib/caption-display.js";

interface CaptionListProps {
  captions: Caption[];
  displayLanguage: DisplayLanguage;
  onClarification: (captionId: string) => void;
}

const copy = {
  ja: { clarification: "確認を依頼", source: "原文", translation: "翻訳" },
  en: { clarification: "Request clarification", source: "Source", translation: "Translation" },
};

export const CaptionList = ({ captions, displayLanguage, onClarification }: CaptionListProps) => {
  const text = copy[displayLanguage];
  return (
    <ol className="caption-list" aria-label={displayLanguage === "ja" ? "字幕" : "Captions"}>
      {captions.map((caption) => (
        <li key={caption.id} className={`caption caption-${caption.state}`}>
          <p><strong>{caption.speaker.displayName}</strong> {primaryCaptionText(caption, displayLanguage)}</p>
          <details>
            <summary>{displayLanguage === "ja" ? "原文と翻訳を表示" : "Show source and translation"}</summary>
            <p>{text.source}: {caption.sourceText}</p>
            <p>{text.translation}: {caption.translatedText ?? "—"}</p>
          </details>
          <button type="button" onClick={() => onClarification(caption.id)}>{text.clarification}</button>
        </li>
      ))}
    </ol>
  );
};
