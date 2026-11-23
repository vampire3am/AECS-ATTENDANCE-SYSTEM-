'use client';
import {
  assignAction,
  cancelAction,
  correctionAction,
  endEnrollmentAction,
  enrollAction,
  generateAction,
  openAction,
  settingsAction,
  transferAction,
} from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EntityForm } from './entity-form';
export function OpenSession({ id, teacher = false }: { id: string; teacher?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  return (
    <>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await openAction(id);
            if (r.ok) router.push(`${teacher ? '/teacher' : '/admin'}/attendance/${id}`);
            else setError(r.error);
          } catch {
            setError('Unable to connect.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Starting class…' : 'Start class'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </>
  );
}
export function GenerateSessions() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <div>
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await generateAction();
            setMessage(r.ok ? 'Today’s timetable is up to date.' : r.error);
            if (r.ok) router.refresh();
          } catch {
            setMessage('Unable to connect.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Checking timetable…' : 'Refresh today’s classes'}
      </Button>
      {message && (
        <p role="status" className="mt-2 text-sm text-slate-500">
          {message}
        </p>
      )}
    </div>
  );
}
export function CancelSession({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Cancel session
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="Cancel session">
        <EntityForm
          fields={[
            { name: 'reason', label: 'Reason for cancellation', required: true, type: 'textarea' },
          ]}
          action={(v) => cancelAction(id, v.reason)}
          label="Confirm cancellation"
          onDone={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
export function CorrectRecord({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="min-h-11 font-semibold text-[#3854AC]" onClick={() => setOpen(true)}>
        Correct
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Correct submitted attendance"
        description="The previous status, your identity, and this reason will be preserved in the audit history."
      >
        <EntityForm
          fields={[
            {
              name: 'status',
              label: 'New status',
              required: true,
              options: ['present', 'absent', 'late', 'excused'].map((s) => ({
                value: s,
                label: s,
              })),
            },
            { name: 'reason', label: 'Correction reason', required: true, type: 'textarea' },
          ]}
          action={(v) => correctionAction({ ...v, recordId: id })}
          label="Save audited correction"
          onDone={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
type Option = { value: string; label: string };
export function EnrollmentForms({
  batchId,
  students,
  batches,
  enrollments,
}: {
  batchId: string;
  students: Option[];
  batches: Option[];
  enrollments: { id: string; label: string }[];
}) {
  const [mode, setMode] = useState('enroll');
  return (
    <div className="panel">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Manage enrollment</h2>
          <p className="muted mt-1">Choose an action for this batch.</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl bg-[#eef1f7] p-1">
          {[
            ['enroll', 'Enroll student'],
            ['transfer', 'Transfer'],
            ['end', 'End enrollment'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              className={
                'min-h-11 rounded-lg px-3 text-xs font-bold ' +
                (mode === value ? 'bg-white text-[#3854ac] shadow-sm' : 'text-slate-500')
              }
              onClick={() => setMode(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {mode === 'enroll' && (
        <section className="max-w-xl">
          <h2 className="font-semibold">Enroll a student</h2>
          <EntityForm
            fields={[
              { name: 'studentId', label: 'Student', options: students, required: true },
              { name: 'enrolledOn', label: 'Enrollment date', type: 'date', required: true },
            ]}
            action={(v) => enrollAction({ ...v, batchId })}
            label="Enroll student"
          />
        </section>
      )}
      {mode === 'transfer' && (
        <section className="max-w-xl">
          <h2 className="font-semibold">Transfer enrollment</h2>
          <EntityForm
            fields={[
              {
                name: 'enrollmentId',
                label: 'Active enrollment',
                options: enrollments.map((e) => ({ value: e.id, label: e.label })),
                required: true,
              },
              {
                name: 'batchId',
                label: 'New batch in same course',
                options: batches,
                required: true,
              },
              { name: 'effectiveOn', label: 'Effective date', type: 'date', required: true },
              { name: 'reason', label: 'Transfer reason', type: 'textarea', required: true },
            ]}
            action={transferAction}
            label="Transfer student"
          />
        </section>
      )}
      {mode === 'end' && (
        <section className="max-w-xl">
          <h2 className="font-semibold">End enrollment</h2>
          <EntityForm
            fields={[
              {
                name: 'id',
                label: 'Active enrollment',
                options: enrollments.map((e) => ({ value: e.id, label: e.label })),
                required: true,
              },
              {
                name: 'endedOn',
                label: 'First day no longer enrolled',
                type: 'date',
                required: true,
              },
              { name: 'reason', label: 'Reason', type: 'textarea', required: true },
            ]}
            action={endEnrollmentAction}
            label="End enrollment"
          />
        </section>
      )}
    </div>
  );
}
export function AssignmentForm({ batchId, teachers }: { batchId: string; teachers: Option[] }) {
  return (
    <EntityForm
      fields={[
        { name: 'teacherId', label: 'Teacher', options: teachers, required: true },
        {
          name: 'active',
          label: 'Assignment',
          defaultValue: 'true',
          options: [
            { value: 'true', label: 'Assign teacher' },
            { value: 'false', label: 'Remove assignment' },
          ],
        },
      ]}
      action={(v) => assignAction({ ...v, batchId, active: v.active === 'true' })}
    />
  );
}
export function SettingsForm({ late, minimum }: { late: boolean; minimum: string }) {
  return (
    <EntityForm
      fields={[
        {
          name: 'lateCountsAsPresent',
          label: 'Late attendance',
          defaultValue: String(late),
          options: [
            { value: 'true', label: 'Counts as present' },
            { value: 'false', label: 'Does not count as present' },
          ],
        },
        {
          name: 'minimumAttendancePercentage',
          label: 'Minimum attendance percentage',
          type: 'number',
          min: '0',
          max: '100',
          defaultValue: minimum,
          required: true,
        },
      ]}
      action={(v) =>
        settingsAction({ ...v, lateCountsAsPresent: v.lateCountsAsPresent === 'true' })
      }
    />
  );
}
