export interface LegalParagraph {
  text: string;
  items?: string[];
}

export interface LegalSection {
  heading: string;
  paragraphs: LegalParagraph[];
}

export interface LegalDocument {
  title: string;
  edition: string;
  effectiveDate: string;
  numbering: "article" | "section";
  preamble: string;
  sections: LegalSection[];
}
