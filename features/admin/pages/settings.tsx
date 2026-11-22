import { PageHeader } from '@/components/shared/page-header';
import { SettingsForm } from '@/components/shared/session-actions';
import { db } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
export async function SettingsPage() {
  const [settings] = await db.select().from(s.appSettings).where(eq(s.appSettings.id, 1));
  return (
    <>
      <PageHeader
        title="Workspace settings"
        description="Attendance rules used consistently across all reports."
      />
      <section className="panel max-w-xl">
        <h2 className="font-semibold">Attendance calculation</h2>
        <SettingsForm
          late={settings.lateCountsAsPresent}
          minimum={settings.minimumAttendancePercentage}
        />
        <p className="muted mt-6">
          Organization timezone: Asia/Kathmandu. Student enrollment is fixed to one active batch per
          course.
        </p>
      </section>
    </>
  );
}
