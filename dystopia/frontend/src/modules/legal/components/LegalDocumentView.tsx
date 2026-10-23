import Link from "next/link";
import { BrandMark } from "@/components/shell/BrandMark";
import type { LegalDocument, LegalParagraph } from "../types";

interface LegalDocumentViewProps {
  document: LegalDocument;
  related: { href: string; label: string };
}

const headingText = (numbering: LegalDocument["numbering"], number: number, heading: string) =>
  numbering === "article" ? `第${number}条（${heading}）` : `${number}. ${heading}`;

function Paragraph({ paragraph, number }: { paragraph: LegalParagraph; number?: number }) {
  return (
    <div className="flex gap-2">
      {number !== undefined && <span className="shrink-0 text-text-secondary">{`${number}.`}</span>}
      <div className="min-w-0 space-y-1">
        <p>{paragraph.text}</p>
        {paragraph.items && (
          <ol className="space-y-1">
            {paragraph.items.map((item, index) => (
              <li key={index} className="flex gap-2">
                <span className="shrink-0 text-text-secondary">{`（${index + 1}）`}</span>
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export function LegalDocumentView({ document, related }: LegalDocumentViewProps) {
  const { title, edition, effectiveDate, numbering, preamble, sections } = document;

  return (
    <main className="mx-auto max-w-xl bg-bg px-4 pb-10 text-text-primary">
      <header className="py-4">
        <BrandMark className="text-lg" />
      </header>
      <h1 className="text-[1.3125rem] font-bold">{title}</h1>
      <p className="pt-0.5 text-xs text-text-secondary">{`${edition}　${effectiveDate}施行`}</p>
      <p className="pt-4 text-sm leading-relaxed">{preamble}</p>
      <nav aria-label="目次" className="mt-4 border-y border-divider py-3">
        <ol className="space-y-1 text-sm">
          {sections.map((section, index) => (
            <li key={index}>
              <a href={`#${numbering}-${index + 1}`} className="text-accent">
                {headingText(numbering, index + 1, section.heading)}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="space-y-6 pt-6">
        {sections.map((section, index) => (
          <section key={index} id={`${numbering}-${index + 1}`}>
            <h2 className="text-base font-bold">{headingText(numbering, index + 1, section.heading)}</h2>
            <div className="space-y-2 pt-2 text-sm leading-relaxed">
              {section.paragraphs.map((paragraph, paragraphIndex) => (
                <Paragraph
                  key={paragraphIndex}
                  paragraph={paragraph}
                  number={numbering === "article" && section.paragraphs.length > 1 ? paragraphIndex + 1 : undefined}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
      <footer className="mt-8 border-t border-divider pt-4 text-sm">
        <Link href={related.href} className="text-accent">
          {related.label}
        </Link>
      </footer>
    </main>
  );
}
