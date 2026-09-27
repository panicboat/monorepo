interface PageHeaderProps {
  title: string;
  description: string;
}

// No own padding/wrapper: each page composes this inside its existing header container.
export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <>
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="pt-1 text-sm text-text-secondary">{description}</p>
    </>
  );
}
