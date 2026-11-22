import { StudentCheckinForm } from './student-form';
export const metadata = { title: 'Student check-in', robots: { index: false, follow: false } };
export default async function StudentCheckin({
  searchParams,
}: {
  searchParams: Promise<{ session?: string; token?: string }>;
}) {
  const { session, token } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-5">
      <p className="mb-8 text-xl font-bold text-[#072B62]">AECS Attend</p>
      <section className="panel">
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-600">
          Classroom check-in
        </p>
        <h1 className="page-title mt-3">I’m here</h1>
        <p className="muted mt-3">
          Scan the QR displayed by your teacher, then enter your private course-and-batch enrollment
          code.
        </p>
        {session && token ? (
          <StudentCheckinForm sessionId={session} token={token} />
        ) : (
          <p className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
            Ask your teacher to open today’s attendance and display the classroom QR. Scan it using
            your phone’s camera.
          </p>
        )}
      </section>
      <p className="muted mt-5 text-center">
        A check-in is a request. Your teacher confirms physical presence.
      </p>
    </main>
  );
}
