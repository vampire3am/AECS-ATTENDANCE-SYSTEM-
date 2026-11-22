'use client';
import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
export function SignOut() {
  return (
    <button
      className="flex min-h-11 items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
      onClick={() => {
        localStorage.removeItem('aecs-offline-actor');
        void signOut({ callbackUrl: '/login' });
      }}
    >
      <LogOut size={16} /> Sign out
    </button>
  );
}
