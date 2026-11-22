'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
export function StudentCheckinForm({ sessionId, token }: { sessionId: string; token: string }) {
  const [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [done, setDone] = useState(false);
  if (done)
    return (
      <div role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-emerald-800">
        <p className="font-semibold">Check-in received</p>
        <p className="mt-2 text-sm">
          Your teacher will verify your presence and finalize attendance. You may close this page.
        </p>
      </div>
    );
  return (
    <form
      className="mt-6 grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          const response = await fetch('/api/check-in', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, token, code: code.trim().toUpperCase() }),
          });
          const body = await response.json();
          if (!response.ok) {
            setError(body.error ?? 'Check-in failed.');
            return;
          }
          setDone(true);
        } catch {
          setError(
            'Connection failed. Reconnect and try again; duplicate check-ins are prevented.',
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="grid gap-2 text-sm font-medium">
        Your enrollment code
        <input
          className="input font-mono"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
          maxLength={40}
          placeholder="AECS-…"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </label>
      <p className="text-xs text-slate-500">
        Use the code issued for this exact course and batch. It is different from your general
        student ID.
      </p>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? 'Checking in…' : 'Check in to class'}
      </Button>
    </form>
  );
}
