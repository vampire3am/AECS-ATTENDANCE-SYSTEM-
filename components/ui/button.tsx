import { cn } from '@/lib/utils';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
const variants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[#072B62] text-white hover:bg-[#123e7e]',
        outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
        ghost: 'text-slate-600 hover:bg-slate-100',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        orange: 'bg-[#F28A00] text-white hover:bg-orange-600',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);
export function Button({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof variants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(variants({ variant, className }))} {...props} />;
}
