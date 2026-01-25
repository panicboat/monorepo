export default function OnboardingTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  // State management handled by useCastData hook (modules/portfolio/hooks)
  return <>{children}</>;
}
