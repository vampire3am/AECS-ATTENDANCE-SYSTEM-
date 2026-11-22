import { cn } from '@/lib/utils';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
const variants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:pointer-events-none disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:border-slate-200',
  {
    variants: {
      variant: {
        default: 'bg-[#3854AC] text-white shadow-sm hover:bg-[#2B4088] active:translate-y-px',
        outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
        ghost: 'text-slate-600 hover:bg-slate-100',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        orange: 'bg-[#C65D12] text-white hover:bg-[#AC4F0F]',
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
