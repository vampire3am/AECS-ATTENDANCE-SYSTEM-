'use client';
import { useState } from 'react';
import { createTeacherAccountAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
export function AddTeacher() {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [access, setAccess] = useState<{ email: string; password: string } | null>(null);
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
          setAccess(null);
          setError('');
        }}
      >
        Add teacher
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
        title={access ? 'Teacher account ready' : 'Add a teacher'}
        description={
          access
            ? 'Save these login details and share them privately with the teacher.'
            : 'Enter their name and email. We’ll generate a secure password.'
        }
      >
        {access ? (
          <div className="mt-6 space-y-4">
            <p className="break-all text-sm font-semibold">{access.email}</p>
            <code className="block select-all break-all rounded-xl bg-slate-50 p-4">
              {access.password}
            </code>
            <p className="muted">
              Assign this teacher when creating a batch, or from an existing batch’s Manage section.
            </p>
            <Button onClick={() => setOpen(false)}>Done</Button>
          </div>
        ) : (
          <form
            className="mt-6 grid gap-5"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                const r = await createTeacherAccountAction(
                  Object.fromEntries(new FormData(e.currentTarget)),
                );
                if (r.ok) setAccess(r.data);
                else setError(r.error);
              } catch {
                setError('Connection failed. Check the teacher list before retrying.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset className="grid gap-5" disabled={busy}>
              <label className="grid gap-2 text-sm font-semibold">
                Full name
                <input name="fullName" className="input" minLength={2} required />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Email address
                <input name="email" type="email" className="input" required />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Phone number
                <input name="phone" type="tel" className="input" placeholder="Optional" />
              </label>
            </fieldset>
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            <Button disabled={busy} type="submit">
              {busy ? 'Creating teacher account…' : 'Create teacher account'}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}
