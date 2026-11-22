import { LoginForm } from './sign-in';
export default function Login() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-[#072B62] p-14 text-white lg:flex">
        <p className="text-2xl font-bold">
          AECS <span className="font-normal">Attend</span>
        </p>
        <div>
          <div className="mb-8 h-1 w-14 bg-[#F28A00]" />
          <h1 className="max-w-md text-5xl font-bold leading-tight tracking-tight">
            Every student.
            <br />
            Every class.
            <br />
            <span className="text-orange-300">Accounted for.</span>
          </h1>
          <p className="mt-6 max-w-sm text-lg text-blue-100">
            A simpler way to keep your classes connected and your students on track.
          </p>
        </div>
        <p className="text-sm text-blue-200">Abroad Education Consultancy Services · Nepal</p>
      </section>
      <section className="flex items-center justify-center bg-white p-6">
        <div className="w-full max-w-sm">
          <p className="mb-12 text-xl font-bold text-[#072B62] lg:hidden">AECS Attend</p>
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-orange-600">
            Staff workspace
          </p>
          <h2 className="page-title">Welcome back</h2>
          <p className="mt-3 text-slate-500">Sign in to manage your classes and attendance.</p>
          <LoginForm />
          <p className="mt-8 text-center text-xs text-slate-400">
            Secure access for AECS staff only.
          </p>
        </div>
      </section>
    </main>
  );
}
