'use client';
import { attendanceAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { draftKey, offlineDb, type Draft, type RosterRow, type SessionModel } from '@/lib/offline';
import { CheckCheck, CheckCircle2, LockKeyhole, Search, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
const statuses = ['present', 'absent', 'late', 'excused'] as const;
export function AttendanceMarking({
  model,
  offline = false,
}: {
  model: SessionModel;
  offline?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(model.records);
  const [search, setSearch] = useState('');
  const [online, setOnline] = useState(true);
  const [sync, setSync] = useState<Draft['sync']>('SYNCED');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(
    model.session.status === 'submitted' || model.session.status === 'cancelled',
  );
  const [ready, setReady] = useState(false);
  const version = useRef(model.session.version);
  const op = useRef('');
  const revision = useRef(0);
  const key = draftKey(model.actorId, model.session.id);
  const rowsRef = useRef(rows);
  const lastAttempt = useRef(-1);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  useEffect(() => {
    let active = true;
    const connectivity = () => {
      lastAttempt.current = -1;
      setOnline(navigator.onLine);
    };
    connectivity();
    window.addEventListener('online', connectivity);
    window.addEventListener('offline', connectivity);
    void (async () => {
      try {
        op.current = crypto.randomUUID();
        localStorage.setItem('aecs-offline-actor', model.actorId);
        const db = await offlineDb();
        const pending = await db.get('drafts', key);
        await db.put('sessions', model, key);
        if (!active) return;
        op.current = pending?.operationId ?? crypto.randomUUID();
        if (pending?.sync === 'PENDING' || pending?.sync === 'CONFLICT') {
          if (pending.version !== model.session.version || model.session.status !== 'open') {
            setSync('CONFLICT');
            setError(
              'A saved draft differs from the server. It is preserved on this device. Review both before replacing it.',
            );
          } else {
            setRows(
              model.records.map((r) => ({
                ...r,
                status:
                  pending.records.find((p) => p.studentId === r.studentId)?.status ?? r.status,
              })),
            );
            setSync(pending.sync);
          }
        }
        if (!pending || pending.sync === 'SYNCED') {
          setRows(model.records);
          version.current = model.session.version;
          setSync('SYNCED');
        }
        setReady(true);
      } catch {
        setError('Local storage is unavailable. Offline changes cannot be saved.');
        setReady(true);
      }
    })();
    return () => {
      active = false;
      window.removeEventListener('online', connectivity);
      window.removeEventListener('offline', connectivity);
    };
  }, [key, model]);
  async function persist(next: RosterRow[]) {
    revision.current++;
    setRows(next);
    setSync('PENDING');
    setError('');
    try {
      await (
        await offlineDb()
      ).put('drafts', {
        key,
        actorId: model.actorId,
        sessionId: model.session.id,
        version: version.current,
        operationId: op.current,
        records: next
          .filter((r) => r.status !== null)
          .map((r) => ({ studentId: r.studentId, status: r.status! })),
        sync: 'PENDING',
        updatedAt: Date.now(),
      });
    } catch {
      setError('Draft was not saved locally. Keep this page open and reconnect.');
    }
  }
  async function exportDraft() {
    const pending = await (await offlineDb()).get('drafts', key);
    if (!pending) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(pending, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `aecs-draft-${model.session.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  async function acceptServerCopy() {
    const db = await offlineDb();
    const pending = await db.get('drafts', key);
    if (pending)
      await db.put('drafts', {
        ...pending,
        key: `${key}:preserved:${Date.now()}`,
        sync: 'CONFLICT',
      });
    version.current = model.session.version;
    op.current = crypto.randomUUID();
    revision.current = 0;
    lastAttempt.current = -1;
    setRows(model.records);
    await db.put('drafts', {
      key,
      actorId: model.actorId,
      sessionId: model.session.id,
      version: model.session.version,
      operationId: op.current,
      records: model.records
        .filter((r) => r.status)
        .map((r) => ({ studentId: r.studentId, status: r.status! })),
      sync: 'SYNCED',
      updatedAt: Date.now(),
    });
    setSync('SYNCED');
    setError('The server copy is active. Your previous draft remains preserved on this device.');
  }
  async function send(finalize: boolean) {
    if (!navigator.onLine) {
      setError('Reconnect to submit attendance. Your local draft is preserved.');
      return;
    }
    if (busy || sync === 'CONFLICT') return;
    setBusy(true);
    setError('');
    const sendingRevision = revision.current;
    const snapshot = rowsRef.current;
    let confirmed = false;
    try {
      const result = await attendanceAction(
        {
          sessionId: model.session.id,
          version: version.current,
          operationId: op.current,
          records: snapshot
            .filter((r) => r.status)
            .map((r) => ({ studentId: r.studentId, status: r.status })),
        },
        finalize,
      );
      if (!result.ok) {
        setError(result.error);
        if (result.status === 409) {
          setSync('CONFLICT');
          if (!offline) router.refresh();
        }
        return;
      }
      confirmed = true;
      setSync('SYNCED');
      if (result.data.status === 'submitted') setLocked(true);
      setConfirm(false);
      version.current = result.data.version;
      const db = await offlineDb();
      const stillCurrent = revision.current === sendingRevision;
      const current = await db.get('drafts', key);
      if (current) {
        current.version = version.current;
        current.sync = stillCurrent ? 'SYNCED' : 'PENDING';
        await db.put('drafts', current);
      }
      await db.put(
        'sessions',
        {
          ...model,
          records: snapshot,
          session: { ...model.session, version: version.current, status: result.data.status },
        },
        key,
      );
      setSync(stillCurrent ? 'SYNCED' : 'PENDING');
      if (result.data.status === 'submitted') setLocked(true);
      setConfirm(false);
    } catch {
      setError(
        confirmed
          ? 'Server confirmed attendance, but the local cache could not be updated.'
          : 'No server confirmation. Your draft is preserved; retry when connected.',
      );
    } finally {
      setBusy(false);
    }
  }
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });
  useEffect(() => {
    if (
      online &&
      ready &&
      sync === 'PENDING' &&
      !busy &&
      !locked &&
      lastAttempt.current !== revision.current
    ) {
      const timer = setTimeout(() => {
        lastAttempt.current = revision.current;
        void sendRef.current(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [online, ready, sync, busy, locked, rows]);
  const totals = Object.fromEntries(
    statuses.map((s) => [s, rows.filter((r) => r.status === s).length]),
  );
  const unmarked = rows.filter((r) => !r.status).length;
  return (
    <div className="space-y-5">
      <div>
        <p className="muted">
          {model.session.sessionDate} · {model.session.startTime.slice(0, 5)}–
          {model.session.endTime.slice(0, 5)}
        </p>
        <h1 className="page-title mt-1">{model.batch.name}</h1>
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          {!online && <WifiOff size={16} />}
          {locked
            ? model.session.status === 'cancelled'
              ? 'Cancelled · Locked'
              : 'Submitted · Locked'
            : !online
              ? 'Offline · Draft only'
              : sync === 'SYNCED'
                ? 'Synced · Server confirmed'
                : sync === 'PENDING'
                  ? 'Pending · Saved on this device'
                  : 'Conflict · Review required'}
        </p>
      </div>
      {locked && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-800"
        >
          <CheckCircle2 size={22} />
          <div>
            <p className="font-semibold">
              {model.session.status === 'cancelled' ? 'Session cancelled' : 'Attendance submitted'}
            </p>
            <p className="text-sm">This session is locked. Contact an admin for corrections.</p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-5 gap-1.5">
        {[...statuses, 'unmarked'].map((s) => (
          <div
            key={s}
            className="rounded-lg border border-slate-200 bg-white px-1 py-3 text-center"
          >
            <p className="text-xl font-bold text-[#072B62]">
              {s === 'unmarked' ? unmarked : totals[s]}
            </p>
            <p className="text-[11px] capitalize text-slate-500">{s}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <Search size={18} className="absolute left-3 top-3.5 text-slate-400" />
          <input
            aria-label="Search students"
            className="input pl-10"
            placeholder="Search name or student code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <Button
          variant="outline"
          disabled={locked || busy || !ready || sync === 'CONFLICT'}
          onClick={() => void persist(rows.map((r) => ({ ...r, status: 'present' })))}
        >
          <CheckCheck size={18} /> Mark all present
        </Button>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {error}
        </p>
      )}
      {sync === 'CONFLICT' && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void exportDraft()}>
            Export saved draft
          </Button>
          {offline ? (
            <Button asChild variant="outline">
              <Link href={`/teacher/attendance/${model.session.id}`}>
                Load current server session
              </Link>
            </Button>
          ) : (
            <Button variant="outline" onClick={() => void acceptServerCopy()}>
              Preserve draft and use server copy
            </Button>
          )}
        </div>
      )}
      <div className="space-y-2">
        {rows
          .filter((r) =>
            `${r.fullName} ${r.studentCode}`.toLowerCase().includes(search.toLowerCase()),
          )
          .map((r, i) => (
            <article key={r.id} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-semibold text-[#072B62]">
                  {r.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.fullName}</p>
                  <p className="text-xs text-slate-400">{r.studentCode}</p>
                </div>
                <span className="ml-auto text-xs text-slate-400">{i + 1}</span>
              </div>
              <div
                role="group"
                aria-label={`Attendance for ${r.fullName}`}
                className="grid grid-cols-4 gap-1.5"
              >
                {statuses.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={r.status === s}
                    disabled={locked || busy || !ready || sync === 'CONFLICT'}
                    onClick={() =>
                      void persist(
                        rows.map((row) => (row.id === r.id ? { ...row, status: s } : row)),
                      )
                    }
                    className={`min-h-11 rounded-lg border text-xs font-semibold capitalize disabled:opacity-60 ${r.status === s ? (s === 'present' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : s === 'absent' ? 'border-red-400 bg-red-50 text-red-700' : s === 'late' ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-indigo-400 bg-indigo-50 text-indigo-700') : 'border-slate-200 text-slate-500'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </article>
          ))}
        {!rows.length && <p className="empty">No students were enrolled on this session date.</p>}
      </div>
      {!locked && (
        <div className="sticky bottom-22 z-10 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <Button
            className="w-full"
            variant="orange"
            disabled={
              !online || busy || !ready || unmarked > 0 || !rows.length || sync === 'CONFLICT'
            }
            onClick={() => setConfirm(true)}
          >
            <LockKeyhole size={17} />
            {busy ? 'Saving…' : `Submit attendance · ${rows.length} students`}
          </Button>
        </div>
      )}
      <Dialog
        title="Submit attendance?"
        description="This finalizes and locks attendance for the entire class. Only an admin can make corrections with a reason."
        open={confirm}
        onOpenChange={setConfirm}
      >
        <p className="my-5 text-sm">
          {totals.present} present · {totals.absent} absent · {totals.late} late · {totals.excused}{' '}
          excused
        </p>
        <Button disabled={busy} className="w-full" onClick={() => void send(true)}>
          {busy ? 'Submitting…' : 'Confirm and submit'}
        </Button>
      </Dialog>
    </div>
  );
}
