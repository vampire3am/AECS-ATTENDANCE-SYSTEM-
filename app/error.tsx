'use client';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="panel mx-auto my-12 max-w-lg">
      <h1 className="page-title">Unable to load this page</h1>
      <p className="my-5 text-slate-600">
        Check your connection and filters, then try again. Your saved records are preserved.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
