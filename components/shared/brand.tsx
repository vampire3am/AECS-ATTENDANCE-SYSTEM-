import Image from 'next/image';

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-3">
      <Image
        src="/brand/aecs-logo.png"
        alt="Abroad Education Consultancy Services"
        width={48}
        height={48}
        className="size-12 rounded-full"
        priority
        unoptimized
      />
      <span className="grid gap-0.5">
        <span
          className={`text-lg font-extrabold tracking-tight ${inverse ? 'text-white' : 'text-[var(--primary)]'}`}
        >
          AECS <span className="font-medium">Attend</span>
        </span>
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${inverse ? 'text-blue-100' : 'text-slate-500'}`}
        >
          Abroad Education
        </span>
      </span>
    </span>
  );
}
