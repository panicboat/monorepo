interface PageHeaderProps {
  title: string;
  description: string;
}

// Keep padding and wrappers at the page level so this header composes with existing layouts.
export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <>
      <h1 className="text-[21px] font-extrabold">{title}</h1>
      <p className="pt-0.5 text-xs text-text-secondary">{description}</p>
    </>
  );
}
