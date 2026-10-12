interface PageHeaderProps {
  title: string;
  description: string;
}

// Keep padding and wrappers at the page level so this header composes with existing layouts.
export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <>
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <p className="pt-2 text-sm leading-relaxed text-text-secondary">{description}</p>
    </>
  );
}
