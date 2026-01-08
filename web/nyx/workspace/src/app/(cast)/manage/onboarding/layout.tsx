"use client";

import { OnboardingProvider } from "./context";

export default function OnboardingTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingProvider>
      {/*
        No layout logic here.
        Visual structure is handled by the parent (manage/layout.tsx)
        and the pages themselves (which use max-w-md).
      */}
      {children}
    </OnboardingProvider>
  );
}
