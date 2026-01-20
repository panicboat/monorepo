export default function OnboardingTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  // State management is now handled by Zustand store (useOnboardingStore)
  // No provider wrapper needed - Zustand uses a global store pattern
  return <>{children}</>;
}
