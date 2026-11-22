'use client';
import { AttendanceMarking } from '@/components/attendance/marking';
import { PreservedDrafts } from '@/components/shared/preserved-drafts';
import { offlineDb, type SessionModel } from '@/lib/offline';
import Link from 'next/link';
import { useEffect, useState } from 'react';
export default function Offline() {
  const [sessions, setSessions] = useState<SessionModel[]>([]);
  const [selected, setSelected] = useState<SessionModel | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void offlineDb()
      .then((db) => db.getAll('sessions'))
      .then((rows) =>
        setSessions(
          rows.filter((row) => row.actorId === localStorage.getItem('aecs-offline-actor')),
        ),
      )
      .catch(() => setError('Offline storage is unavailable on this device.'));
  }, []);
  return (
    <main className="mx-auto max-w-2xl p-4 pb-24">
      {selected ? (
        <AttendanceMarking model={selected} offline />
      ) : (
        <>
          <h1 className="page-title">Offline workspace</h1>
          <p className="mt-3 text-slate-600">
            Continue a saved attendance draft on this trusted device. Reconnect and sign in to
            finalize.
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="mt-6 grid gap-3">
            {sessions.map((s) => (
              <button
                className="panel text-left"
                key={`${s.actorId}:${s.session.id}`}
                onClick={() => setSelected(s)}
              >
                <strong>{s.batch.name}</strong>
                <p className="muted">
                  {s.session.sessionDate} · {s.session.startTime.slice(0, 5)}
                </p>
              </button>
            ))}
            {!sessions.length && (
              <p className="empty">Open a class while online to make its roster available here.</p>
            )}
          </div>
          <Link className="mt-8 inline-block font-semibold text-[#072B62]" href="/">
            Reconnect to workspace
          </Link>
          <PreservedDrafts />
        </>
      )}
    </main>
  );
}
