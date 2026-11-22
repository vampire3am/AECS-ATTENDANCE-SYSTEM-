'use client';
import { useState } from 'react';
export function EnrollmentCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false),
    [error, setError] = useState(false);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <code className="break-all rounded-lg border border-[#e3e8f6] bg-[#f6f8fe] px-2.5 py-2 text-xs font-semibold text-[#3854AC]">
          {code}
        </code>
        <button
          type="button"
          className="min-h-11 rounded-lg px-2 text-xs font-bold text-[#3854AC] hover:bg-[#eef1fb]"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setError(false);
            } catch {
              setError(true);
            }
          }}
        >
          {copied ? 'Copied' : 'Copy code'}
        </button>
      </div>
      {error && <p className="text-xs text-amber-700">Select and copy the code manually.</p>}
      <p className="mt-1 text-[11px] text-slate-500">Private to this student, course and batch.</p>
    </div>
  );
}
