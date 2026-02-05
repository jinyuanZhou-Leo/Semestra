import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "h-5 gap-1 rounded-4xl border border-neutral-200 border-transparent px-2 py-0.5 text-xs font-medium transition-all has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:size-3! inline-flex items-center justify-center w-fit whitespace-nowrap shrink-0 [&>svg]:pointer-events-none focus-visible:border-neutral-950 focus-visible:ring-neutral-950/50 focus-visible:ring-[3px] aria-invalid:ring-red-500/20 dark:aria-invalid:ring-red-500/40 aria-invalid:border-red-500 overflow-hidden group/badge dark:border-neutral-800 dark:focus-visible:border-neutral-300 dark:focus-visible:ring-neutral-300/50 dark:aria-invalid:ring-red-900/20 dark:dark:aria-invalid:ring-red-900/40 dark:aria-invalid:border-red-900",
  {
    variants: {
      variant: {
        default: "bg-neutral-900 text-neutral-50 [a]:hover:bg-neutral-900/80 dark:bg-neutral-50 dark:text-neutral-900 dark:[a]:hover:bg-neutral-50/80",
        secondary: "bg-neutral-100 text-neutral-900 [a]:hover:bg-neutral-100/80 dark:bg-neutral-800 dark:text-neutral-50 dark:[a]:hover:bg-neutral-800/80",
        destructive: "bg-red-500/10 [a]:hover:bg-red-500/20 focus-visible:ring-red-500/20 dark:focus-visible:ring-red-500/40 text-red-500 dark:bg-red-500/20 dark:bg-red-900/10 dark:[a]:hover:bg-red-900/20 dark:focus-visible:ring-red-900/20 dark:dark:focus-visible:ring-red-900/40 dark:text-red-900 dark:dark:bg-red-900/20",
        outline: "border-neutral-200 text-neutral-950 [a]:hover:bg-neutral-100 [a]:hover:text-neutral-500 dark:border-neutral-800 dark:text-neutral-50 dark:[a]:hover:bg-neutral-800 dark:[a]:hover:text-neutral-400",
        ghost: "hover:bg-neutral-100 hover:text-neutral-500 dark:hover:bg-neutral-100/50 dark:hover:bg-neutral-800 dark:hover:text-neutral-400 dark:dark:hover:bg-neutral-800/50",
        link: "text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
