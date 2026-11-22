import Link from 'next/link';
export default function ForgotPassword() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6">
      <section className="panel">
        <h1 className="page-title">Recover your account</h1>
        <p className="mt-4 text-slate-600">
          Contact your AECS Super Admin to verify your identity and reset your staff password.
          Password recovery by email is not enabled.
        </p>
        <Link className="mt-6 inline-block font-semibold text-[#072B62]" href="/login">
          Return to sign in
        </Link>
      </section>
    </main>
  );
}
