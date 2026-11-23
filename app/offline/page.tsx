'use client';
import { Brand } from '@/components/shared/brand';
import { AttendanceMarking } from '@/components/attendance/marking';
import { PreservedDrafts } from '@/components/shared/preserved-drafts';
import { authorizedCachedSessions, offlineDb, type SessionModel } from '@/lib/offline';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
export default function Offline() {
  const [sessions, setSessions] = useState<SessionModel[]>([]),
    [selected, setSelected] = useState<SessionModel | null>(null),
    [actorId, setActorId] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(true);
  useEffect(() => {
    let active = true,
      pending = false;
    const controller = new AbortController();
    async function check() {
      if (pending) return;
      pending = true;
      try {
        const r = await fetch('/api/staff/access', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!r.ok)
          throw Error(
            r.status === 401
              ? 'Sign in again to verify your course access.'
              : 'Unable to verify access. Reconnect and try again.',
          );
        const access = await r.json();
        const db = await offlineDb();
        const rows = authorizedCachedSessions(await db.getAll('sessions'), access);
        db.close();
        if (!active) return;
        setActorId(access.actorId);
        setSessions(rows);
        setSelected((current) =>
          current && rows.some((r) => r.session.id === current.session.id) ? current : null,
        );
        setError('');
      } catch (e) {
        if (active) {
          setSessions([]);
          setSelected(null);
          setActorId('');
          setError(
            e instanceof Error && e.name !== 'AbortError'
              ? e.message
              : 'Reconnect to verify access before opening a cached roster.',
          );
        }
      } finally {
        pending = false;
        if (active) setBusy(false);
      }
    }
    void check();
    const timer = setInterval(() => void check(), 15000);
    const focus = () => void check();
    window.addEventListener('focus', focus);
    window.addEventListener('online', focus);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('focus', focus);
      window.removeEventListener('online', focus);
    };
  }, []);
  const sessionIds = useMemo(() => sessions.map((r) => r.session.id), [sessions]);
  return (
    <main className="mx-auto max-w-2xl p-4 pb-24">
      <div className="mb-7 mt-3">
        <Brand />
      </div>
      {selected ? (
        <AttendanceMarking model={selected} offline />
      ) : (
        <>
          <h1 className="page-title">Saved attendance drafts</h1>
          <p className="muted mt-3">
            Reconnect to verify your current course and batch access before opening a saved roster.
            Unsynced drafts remain preserved on this device.
          </p>
          {busy && (
            <p role="status" className="mt-5 text-sm text-slate-500">
              Checking access…
            </p>
          )}
          {error && (
            <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              {error}
            </p>
          )}
          <div className="mt-6 grid gap-3">
            {sessions.map((s) => (
              <button
                className="panel text-left"
                key={s.actorId + ':' + s.session.id}
                onClick={() => setSelected(s)}
              >
                <strong>{s.batch.name}</strong>
                <p className="muted">
                  {s.session.sessionDate} · {s.session.startTime.slice(0, 5)}
                </p>
              </button>
            ))}
            {!busy && !error && !sessions.length && (
              <p className="empty">No authorized saved rosters. Open a class from Today.</p>
            )}
          </div>
          <Link
            href="/login"
            className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-[#3854ac]"
          >
            Sign in to your workspace →
          </Link>
          {actorId && <PreservedDrafts actorId={actorId} sessionIds={sessionIds} />}
        </>
      )}
    </main>
  );
}
