'use client';
import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import {
  enrollmentWhatsAppUrl,
  whatsappPhone,
  type EnrollmentRecipient,
} from '@/lib/enrollment-message';
export function EnrollmentCode({
  code,
  recipient,
}: {
  code: string;
  recipient?: EnrollmentRecipient;
}) {
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
        {recipient && (
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            aria-label={`Send ${recipient.studentName}’s ${recipient.batchName} code on WhatsApp`}
            onClick={() =>
              window.open(
                enrollmentWhatsAppUrl(code, recipient, window.location.origin),
                '_blank',
                'noopener,noreferrer',
              )
            }
          >
            <MessageCircle size={15} aria-hidden="true" /> Send on WhatsApp
          </button>
        )}
      </div>
      {error && <p className="text-xs text-amber-700">Select and copy the code manually.</p>}
      <p className="mt-1 text-[11px] text-slate-500">Private to this student, course and batch.</p>
      {recipient && (
        <p className="mt-1 text-[11px] text-slate-500">
          {whatsappPhone(recipient.phone)
            ? 'Review the message in WhatsApp, then send.'
            : 'Choose the student’s WhatsApp contact, review the message, then send.'}
        </p>
      )}
    </div>
  );
}
