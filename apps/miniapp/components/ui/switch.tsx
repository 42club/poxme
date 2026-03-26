'use client'

import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'

import { cn } from '@/lib/utils'

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-7 w-11 shrink-0 items-center rounded-full border border-white/8 bg-input/90 p-[2px] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[background-color,box-shadow] outline-none data-[state=checked]:bg-primary focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={
          'pointer-events-none block size-5 rounded-full bg-white ring-0 shadow-md transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0'
        }
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
