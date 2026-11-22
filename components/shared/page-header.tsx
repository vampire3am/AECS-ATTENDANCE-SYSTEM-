export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="page-title">{title}</h1>
        {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function Badge({ status }: { status: string }) {
  return (
    <span className="badge capitalize" data-status={status}>
      {status.replaceAll('_', ' ')}
    </span>
  );
}
