'use client';
import { Button } from '@/components/ui/button';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
const schema = z.object({ email: z.email(), password: z.string().min(1) });
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  return (
    <form
      className="mt-8 grid gap-5"
      onSubmit={handleSubmit(async (values) => {
        setError('');
        try {
          const result = await signIn('credentials', { ...values, redirect: false });
          if (result?.ok) router.push('/');
          else setError('Unable to sign in. Check your credentials or try again after 15 minutes.');
        } catch {
          setError('Unable to connect. Please try again.');
        }
      })}
    >
      <label className="grid gap-2 text-sm font-medium">
        Email address
        <input className="input" type="email" autoComplete="username" {...register('email')} />
        {errors.email && <span className="text-red-600">Enter a valid email.</span>}
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Password
        <input
          className="input"
          type="password"
          autoComplete="current-password"
          {...register('password')}
        />
      </label>
      <Link href="/forgot-password" className="text-right text-sm text-[#3854AC]">
        Forgot password?
      </Link>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button disabled={isSubmitting} className="w-full" type="submit">
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
