'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { offlineDb } from '@/lib/offline';
export function AccessGuard({ actorId }: { actorId: string }) {
  const pathname = usePathname(),
    router = useRouter();
  const [revoked, setRevoked] = useState(false);
  useEffect(() => {
    let active = true,
      pending = false,
      previous = '';
    const controller = new AbortController();
    async function check() {
      if (pending || !navigator.onLine || document.visibilityState === 'hidden') return;
      pending = true;
      try {
        const r = await fetch('/api/staff/access', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!active) return;
        if (r.status === 401 || r.status === 403) {
          setRevoked(true);
          try {
            localStorage.removeItem('aecs-offline-actor');
          } catch {
            /* Storage may be disabled. */
          }
          // The database session version has already invalidated the old credential.
          window.location.replace('/login?reason=access-changed');
          return;
        }
        if (!r.ok) return;
        const state = await r.json();
        if (state.actorId !== actorId) {
          setRevoked(true);
          window.location.replace('/login');
          return;
        }
        const fingerprint = JSON.stringify(state.batchIds);
        try {
          const db = await offlineDb();
          const tx = db.transaction('sessions', 'readwrite');
          for (const row of await tx.store.getAll())
            if (row.actorId === actorId && !state.batchIds.includes(row.session.batchId))
              await tx.store.delete(`${row.actorId}:${row.session.id}`);
          await tx.done;
          db.close();
        } catch {
          /* Preserve drafts; cache failure never bypasses server authorization. */
        }
        if (previous && previous !== fingerprint) router.refresh();
        previous = fingerprint;
      } catch {
        /* Connectivity errors never grant new access. Server actions reauthorize. */
      } finally {
        pending = false;
      }
    }
    void check();
    const timer = setInterval(() => void check(), 15000);
    const focus = () => void check();
    window.addEventListener('focus', focus);
    window.addEventListener('online', focus);
    window.addEventListener('pageshow', focus);
    document.addEventListener('visibilitychange', focus);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('focus', focus);
      window.removeEventListener('online', focus);
      window.removeEventListener('pageshow', focus);
      document.removeEventListener('visibilitychange', focus);
    };
  }, [actorId, pathname, router]);
  return revoked ? (
    <div
      role="alert"
      className="fixed inset-0 z-[100] grid place-items-center bg-white p-8 text-center"
    >
      <p className="font-semibold text-[#3854ac]">Your access changed. Please sign in again.</p>
    </div>
  ) : null;
}
