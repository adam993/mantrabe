import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium tracking-wide transition-[background,border-color,color,transform] active:translate-y-px disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground border border-primary hover:bg-[var(--primary-press)] hover:border-[var(--primary-press)]',
        ghost:
          'bg-transparent border border-[var(--border-strong)] text-foreground hover:bg-card',
        destructive:
          'bg-transparent border border-transparent text-destructive hover:bg-destructive/10 hover:border-destructive',
        link: 'bg-transparent border-none text-primary underline-offset-4 hover:underline',
        subtle: 'bg-transparent border-none text-muted-foreground hover:text-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-[0.9rem]',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10 p-0 text-xl font-light font-serif-zen leading-none',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
