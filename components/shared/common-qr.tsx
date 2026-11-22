'use client';
import { useRef, useState } from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { ChevronDown, Download, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function CommonQr() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://aecs-attendance.vercel.app'}/check-in`;
  return (
    <details id="common-qr" className="qr-disclosure panel mb-5 !p-0">
      <summary className="flex min-h-20 items-center gap-3 px-5 py-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#eef1fb] text-[#3854ac]">
          <QrCode size={21} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">Common AECS attendance QR</span>
          <span className="muted block">One QR. Every course and batch.</span>
        </span>
        <span className="hidden text-xs font-semibold text-[#3854ac] sm:inline">
          View & download
        </span>
        <ChevronDown
          size={17}
          className="qr-chevron shrink-0 text-slate-400 transition-transform"
        />
      </summary>
      <div className="flex flex-col gap-6 border-t border-slate-100 p-5 sm:flex-row sm:items-center">
        <div className="shrink-0 self-center rounded-xl border border-slate-100 bg-white p-2">
          <QRCodeSVG
            value={url}
            size={160}
            level="M"
            marginSize={4}
            title="Common AECS attendance QR for all batches"
          />
          <QRCodeCanvas
            ref={canvas}
            value={url}
            size={1000}
            level="M"
            marginSize={4}
            className="hidden"
          />
        </div>
        <div>
          <h2 className="font-bold text-[#253963]">Print once. Use every day.</h2>
          <p className="muted mt-2 max-w-lg">
            One permanent QR for all current and future batches. Print it once. Each student’s
            private enrollment code identifies their course and batch automatically. Open today’s
            class before check-in, then confirm each student’s physical presence.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!canvas.current) return;
                const link = document.createElement('a');
                link.href = canvas.current.toDataURL('image/png');
                link.download = 'AECS-Common-Attendance-QR.png';
                link.click();
              }}
            >
              <Download size={16} />
              Download QR
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                } catch {
                  window.prompt('Copy the common check-in link:', url);
                }
              }}
            >
              {copied ? 'Copied' : 'Copy common link'}
            </Button>
          </div>
        </div>
      </div>
    </details>
  );
}
