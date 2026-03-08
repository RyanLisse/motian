interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="break-words text-2xl font-bold text-foreground">{title}</h1>
        {description && <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:self-start">
          {children}
        </div>
      )}
    </div>
  );
}
