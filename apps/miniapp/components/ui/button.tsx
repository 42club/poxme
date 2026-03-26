import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex select-none touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold transition-[transform,background-color,color,border-color,box-shadow] duration-150 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(74,158,255,0.3)] hover:bg-primary/90',
        destructive:
          'bg-destructive text-white shadow-[0_10px_22px_rgba(239,68,68,0.22)] hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border border-white/10 bg-background/50 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-accent/12 hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary:
          'bg-secondary/95 text-secondary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-secondary',
        ghost:
          'hover:bg-accent/12 hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-4 py-2 has-[>svg]:px-3.5',
        sm: 'h-9 rounded-xl gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-12 rounded-2xl px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
