export default function Loading() {
  return (
    <div className="p-8" role="status">
      <div className="h-7 w-48 animate-pulse rounded bg-slate-200" />
      <div className="mt-6 h-48 animate-pulse rounded-xl bg-slate-100" />
      <span className="sr-only">Loading workspace…</span>
    </div>
  );
}
