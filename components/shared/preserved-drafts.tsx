'use client';
import { Button } from '@/components/ui/button';
import { offlineDb, type Draft } from '@/lib/offline';
import { useEffect, useState } from 'react';
export function PreservedDrafts() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  useEffect(() => {
    void offlineDb()
      .then((db) => db.getAll('drafts'))
      .then((rows) =>
        setDrafts(
          rows.filter(
            (r) => r.sync !== 'SYNCED' && r.actorId === localStorage.getItem('aecs-offline-actor'),
          ),
        ),
      );
  }, []);
  return (
    <section className="panel mt-6">
      <h2 className="font-semibold">Preserved drafts</h2>
      <p className="muted mt-2">
        Pending or conflicting drafts remain on this device until you reconcile them.
      </p>
      {drafts.map((d) => (
        <div
          key={d.key}
          className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"
        >
          <p className="text-xs text-slate-500">
            {d.sessionId.slice(0, 8)} · {d.records.length} marks · {d.sync}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }),
              );
              const link = document.createElement('a');
              link.href = url;
              link.download = `aecs-draft-${d.sessionId}.json`;
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export draft
          </Button>
        </div>
      ))}
      {!drafts.length && <p className="muted mt-4">No unsynchronized drafts.</p>}
    </section>
  );
}
