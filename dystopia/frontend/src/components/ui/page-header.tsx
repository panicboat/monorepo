interface PageHeaderProps {
  title: string;
  description: string;
}

// Keep padding and wrappers at the page level so this header composes with existing layouts.
export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <>
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="pt-1 text-sm text-text-secondary">{description}</p>
    </>
  );
}
