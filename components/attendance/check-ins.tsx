'use client';
import { useEffect, useState } from 'react';
import { CommonQr } from '@/components/shared/common-qr';
import { useRouter } from 'next/navigation';
import { Check, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { verifyCheckinAction } from '@/app/actions';
type Checkin = {
  id: string;
  fullName: string;
  studentCode: string;
  checkedInAt: string;
  verifiedAt: string | null;
};
export function SessionCheckins({ sessionId }: { sessionId: string }) {
  const [rows, setRows] = useState<Checkin[]>([]),
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
  return (
    <>
      <CommonQr />
      <section className="panel !p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <UserCheck size={18} className="text-[#3854ac]" /> Student check-ins{' '}
              <span className="badge">{rows.filter((r) => !r.verifiedAt).length} pending</span>
            </h2>
            <p className="muted mt-1">Confirm students you can see in the classroom.</p>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
            <span className="size-1.5 rounded-full bg-emerald-500" /> Updates every 5 seconds
          </span>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="mt-4 space-y-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-[#fafbfe] p-4"
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
            <p className="rounded-xl bg-slate-50 px-4 py-5 text-center text-xs text-slate-500">
              Waiting for students to scan the common QR and check in.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
