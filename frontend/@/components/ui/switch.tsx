import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "data-checked:bg-neutral-900 data-unchecked:bg-neutral-200 focus-visible:border-neutral-950 focus-visible:ring-neutral-950/50 aria-invalid:ring-red-500/20 dark:aria-invalid:ring-red-500/40 aria-invalid:border-red-500 dark:aria-invalid:border-red-500/50 dark:data-unchecked:bg-neutral-200/80 shrink-0 rounded-full border border-neutral-200 border-transparent shadow-xs focus-visible:ring-3 aria-invalid:ring-3 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] peer group/switch relative inline-flex items-center transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 data-disabled:cursor-not-allowed data-disabled:opacity-50 dark:data-checked:bg-neutral-50 dark:data-unchecked:bg-neutral-800 dark:focus-visible:border-neutral-300 dark:focus-visible:ring-neutral-300/50 dark:aria-invalid:ring-red-900/20 dark:dark:aria-invalid:ring-red-900/40 dark:aria-invalid:border-red-900 dark:dark:aria-invalid:border-red-900/50 dark:dark:data-unchecked:bg-neutral-800/80 dark:border-neutral-800",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="bg-white dark:data-unchecked:bg-neutral-950 dark:data-checked:bg-neutral-50 rounded-full group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 pointer-events-none block ring-0 transition-transform dark:bg-neutral-950 dark:dark:data-unchecked:bg-neutral-50 dark:dark:data-checked:bg-neutral-900"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
