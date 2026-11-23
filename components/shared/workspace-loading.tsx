import { Brand } from './brand';
export function WorkspaceLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8"
    >
      <div className="mb-9 flex flex-wrap items-center justify-between gap-4">
        <Brand />
        <span className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="size-4 animate-spin rounded-full border-2 border-[#dce3f6] border-t-[#3854ac] motion-reduce:animate-none" />
          Loading your workspace…
        </span>
      </div>
      <div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse">
        <div className="h-8 w-32 rounded-lg bg-slate-200/70" />
        <div className="h-24 rounded-2xl bg-[#eef1fb]" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="panel space-y-5">
              <div className="h-4 w-24 rounded bg-slate-100" />
              <div className="h-6 w-44 rounded bg-slate-200/70" />
              <div className="h-4 w-32 rounded bg-slate-100" />
              <div className="h-11 rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
