import type { Metadata } from "next";
import { LegalDocumentView } from "@/modules/legal/components/LegalDocumentView";
import { TERMS } from "@/modules/legal/content/terms";

export const metadata: Metadata = {
  title: "利用規約 | dystopia.city",
};

export default function TermsPage() {
  return <LegalDocumentView document={TERMS} related={{ href: "/privacy", label: "プライバシーポリシー" }} />;
}
