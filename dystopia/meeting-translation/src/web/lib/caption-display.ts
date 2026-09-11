import type { Caption, DisplayLanguage } from "../../shared/meeting.js";

const sourceDisplayLanguage = (sourceLanguage: Caption["sourceLanguage"]): DisplayLanguage =>
  sourceLanguage === "ja-JP" ? "ja" : "en";

export const primaryCaptionText = (caption: Caption, displayLanguage: DisplayLanguage): string => {
  if (sourceDisplayLanguage(caption.sourceLanguage) === displayLanguage) return caption.sourceText;
  return caption.translatedText ?? caption.sourceText;
};
