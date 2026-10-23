import type { Metadata } from "next";
import { LegalDocumentView } from "@/modules/legal/components/LegalDocumentView";
import { PRIVACY } from "@/modules/legal/content/privacy";

export const metadata: Metadata = {
  title: "プライバシーポリシー | dystopia.city",
};

export default function PrivacyPage() {
  return <LegalDocumentView document={PRIVACY} related={{ href: "/terms", label: "利用規約" }} />;
}
