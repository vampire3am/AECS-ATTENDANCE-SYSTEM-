'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, Play } from 'lucide-react';
import { startClassAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

export function StartClass({
  batchId,
  scheduleId,
  teacher = false,
  disabled = false,
}: {
  batchId: string;
  scheduleId?: string;
  teacher?: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function start(times?: { startTime: string; endTime: string }) {
    setBusy(true);
    setError('');
    try {
      const r = await startClassAction({ batchId, scheduleId, ...times });
      if (r.ok) router.push(`${teacher ? '/teacher' : '/admin'}/attendance/${r.data.id}`);
      else {
        setError(r.error);
        setBusy(false);
      }
    } catch {
      setError('Unable to connect. Retry to resume the same class.');
      setBusy(false);
    }
  }
  return (
    <div>
      <Button
        disabled={busy || disabled}
        onClick={() => (scheduleId ? void start() : setOpen(true))}
      >
        {busy ? <LoaderCircle size={17} className="animate-spin" /> : <Play size={16} />}{' '}
        {busy ? 'Starting class…' : 'Start class'}
      </Button>
      {!open && error && (
        <p role="alert" className="mt-2 max-w-xs text-xs text-red-600">
          {error}
        </p>
      )}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
        title="Start an extra class"
        description="There’s no timetable entry selected. Set the times for today’s class."
      >
        <form
          className="mt-6 grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void start({
              startTime: String(f.get('startTime')),
              endTime: String(f.get('endTime')),
            });
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <label className="grid gap-2 text-sm font-semibold">
              Start time
              <input
                name="startTime"
                type="time"
                defaultValue="07:00"
                className="input"
                required
                disabled={busy}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              End time
              <input
                name="endTime"
                type="time"
                defaultValue="08:00"
                className="input"
                required
                disabled={busy}
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <Button disabled={busy} type="submit">
            {busy ? 'Starting class…' : 'Start class'}
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
