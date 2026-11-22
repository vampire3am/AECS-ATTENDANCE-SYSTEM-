'use client';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useRouter } from 'next/navigation';
import { QrCode, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { startCheckinAction, verifyCheckinAction } from '@/app/actions';
type Checkin = {
  id: string;
  fullName: string;
  studentCode: string;
  checkedInAt: string;
  verifiedAt: string | null;
};
export function SessionCheckins({ sessionId }: { sessionId: string }) {
  const [rows, setRows] = useState<Checkin[]>([]),
    [qr, setQr] = useState<{ url: string; expiresAt: string } | null>(null),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const router = useRouter();
  useEffect(() => {
    let active = true;
    async function refresh() {
      if (!navigator.onLine) return;
      try {
        const response = await fetch(`/api/sessions/${sessionId}/check-ins`, { cache: 'no-store' });
        if (response.ok && active) setRows(await response.json());
      } catch {
        /* Preserve the last server-confirmed check-in list while offline. */
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [sessionId]);
  async function showQr() {
    setBusy(true);
    setError('');
    try {
      const result = await startCheckinAction(sessionId);
      if (result.ok) {
        setQr(result.data);
        setOpen(true);
      } else setError(result.error);
    } catch {
      setError('Unable to open check-in. Check your connection.');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => {
      void startCheckinAction(sessionId)
        .then((r) => {
          if (r.ok) setQr(r.data);
          else setError(r.error);
        })
        .catch(() => setError('Could not refresh the QR. Reconnect and reopen it.'));
    }, 90000);
    return () => clearInterval(timer);
  }, [open, sessionId]);
  return (
    <section className="panel mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Student QR check-in</h2>
          <p className="muted mt-1">
            Students scan your class QR and enter their private enrollment code.
          </p>
        </div>
        <Button variant="outline" disabled={busy} onClick={() => void showQr()}>
          <QrCode size={18} />
          {busy ? 'Opening…' : 'Show classroom QR'}
        </Button>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Confirm each student’s physical presence. A scan alone does not mark attendance.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3"
          >
            <div>
              <p className="text-sm font-semibold">{row.fullName}</p>
              <p className="text-xs text-slate-500">
                {row.studentCode} ·{' '}
                {new Date(row.checkedInAt).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Asia/Kathmandu',
                })}
              </p>
            </div>
            {row.verifiedAt ? (
              <span className="flex items-center gap-1 text-sm text-emerald-700">
                <Check size={16} />
                Confirmed
              </span>
            ) : (
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  try {
                    const result = await verifyCheckinAction(row.id);
                    if (result.ok) {
                      setRows((current) =>
                        current.map((r) =>
                          r.id === row.id ? { ...r, verifiedAt: new Date().toISOString() } : r,
                        ),
                      );
                      router.refresh();
                    } else setError(result.error);
                  } catch {
                    setError('Unable to confirm. Check your connection.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Confirm present
              </Button>
            )}
          </div>
        ))}
        {!rows.length && (
          <p className="muted">No student check-ins yet. This list updates automatically.</p>
        )}
      </div>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Scan to check in"
        description="Students: scan with your phone camera, then enter the enrollment code issued for this course and batch."
      >
        {qr && (
          <div className="mt-6 grid justify-items-center gap-4">
            <div className="rounded-xl bg-white p-4">
              <QRCodeSVG
                value={qr.url}
                size={232}
                level="M"
                title="Scan to open AECS student check-in"
              />
            </div>
            <p className="text-center text-sm text-slate-500">
              QR valid until{' '}
              {new Date(qr.expiresAt).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZone: 'Asia/Kathmandu',
              })}{' '}
              Nepal time.
              <br />
              Refreshes automatically while this dialog is open.
            </p>
            <Button variant="outline" onClick={() => void showQr()} disabled={busy}>
              Refresh QR now
            </Button>
          </div>
        )}
      </Dialog>
    </section>
  );
}
