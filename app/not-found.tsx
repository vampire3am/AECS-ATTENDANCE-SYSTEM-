import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="panel mx-auto my-12 max-w-lg">
      <h1 className="page-title">Page not found</h1>
      <p className="my-5 text-slate-500">
        This record may be unavailable or the address may be incorrect.
      </p>
      <Link href="/" className="font-semibold text-[#072B62]">
        Return to workspace
      </Link>
    </div>
  );
}
