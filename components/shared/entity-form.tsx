'use client';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
export type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: string;
  min?: string;
  max?: string;
};
export type FormValues = Record<string, string>;
export function EntityForm({
  fields,
  action,
  label = 'Save changes',
  defaults = {},
  onDone,
}: {
  fields: Field[];
  action: (values: FormValues) => Promise<{ ok: boolean; error?: string }>;
  label?: string;
  defaults?: Record<string, unknown>;
  onDone?: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({
    defaultValues: Object.fromEntries(
      fields.map((f) => [f.name, String(defaults[f.name] ?? f.defaultValue ?? '')]),
    ),
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  return (
    <form
      className="mt-5 grid gap-4"
      onSubmit={handleSubmit(async (values) => {
        setError('');
        setSuccess(false);
        try {
          const result = await action(values);
          if (!result.ok) {
            setError(result.error ?? 'Unable to save.');
            return;
          }
          setSuccess(true);
          reset();
          router.refresh();
          onDone?.();
        } catch {
          setError('Connection failed. Your changes have not been confirmed.');
        }
      })}
    >
      {fields.map((f) => (
        <label key={f.name} className="grid gap-1.5 text-sm font-medium text-slate-700">
          <span>
            {f.label}
            {f.required && (
              <span className="ml-1 text-[#b66b3b]" aria-hidden="true">
                *
              </span>
            )}
          </span>
          {f.type === 'textarea' ? (
            <textarea
              rows={3}
              className="input"
              aria-invalid={Boolean(errors[f.name])}
              {...register(f.name, { required: f.required })}
            />
          ) : f.options ? (
            <select
              className="input"
              aria-invalid={Boolean(errors[f.name])}
              {...register(f.name, { required: f.required })}
            >
              {!f.defaultValue && <option value="">Select {f.label.toLowerCase()}</option>}
              {f.options.map((o) => (
                <option value={o.value} key={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              aria-invalid={Boolean(errors[f.name])}
              type={f.type ?? 'text'}
              min={f.min}
              max={f.max}
              autoComplete={f.type === 'password' ? 'new-password' : undefined}
              {...register(f.name, { required: f.required })}
            />
          )}
          {errors[f.name] && (
            <span role="alert" className="text-xs text-red-600">
              This field is required.
            </span>
          )}
        </label>
      ))}
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm text-emerald-700">
          Saved successfully.
        </p>
      )}
      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? 'Saving…' : label}
      </Button>
    </form>
  );
}
