'use client';
import { useState } from 'react';
export function EnrollmentCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false),
    [error, setError] = useState(false);
  return (
    <div>
      <code className="break-all text-xs font-semibold text-[#072B62]">{code}</code>
      <button
        type="button"
        className="ml-2 min-h-10 text-xs font-semibold text-[#072B62]"
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
      {error && <p className="text-xs text-amber-700">Select and copy the code manually.</p>}
      <p className="text-xs text-slate-400">Private to this student, course and batch.</p>
    </div>
  );
}
