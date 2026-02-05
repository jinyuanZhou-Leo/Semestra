import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "focus-visible:border-neutral-950 focus-visible:ring-neutral-950/50 aria-invalid:ring-red-500/20 dark:aria-invalid:ring-red-500/40 aria-invalid:border-red-500 dark:aria-invalid:border-red-500/50 rounded-md border border-neutral-200 border-transparent bg-clip-padding text-sm font-medium focus-visible:ring-3 aria-invalid:ring-3 [&_svg:not([class*='size-'])]:size-4 inline-flex items-center justify-center whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none group/button select-none dark:focus-visible:border-neutral-300 dark:focus-visible:ring-neutral-300/50 dark:aria-invalid:ring-red-900/20 dark:dark:aria-invalid:ring-red-900/40 dark:aria-invalid:border-red-900 dark:dark:aria-invalid:border-red-900/50 dark:border-neutral-800",
  {
    variants: {
      variant: {
        default: "bg-neutral-900 text-neutral-50 hover:bg-neutral-900/80 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-50/80",
        outline: "border-neutral-200 bg-white hover:bg-neutral-100 hover:text-neutral-950 dark:bg-neutral-200/30 dark:border-neutral-200 dark:hover:bg-neutral-200/50 aria-expanded:bg-neutral-100 aria-expanded:text-neutral-950 shadow-xs dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-800 dark:hover:text-neutral-50 dark:dark:bg-neutral-800/30 dark:dark:border-neutral-800 dark:dark:hover:bg-neutral-800/50 dark:aria-expanded:bg-neutral-800 dark:aria-expanded:text-neutral-50",
        secondary: "bg-neutral-100 text-neutral-900 hover:bg-neutral-100/80 aria-expanded:bg-neutral-100 aria-expanded:text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-800/80 dark:aria-expanded:bg-neutral-800 dark:aria-expanded:text-neutral-50",
        ghost: "hover:bg-neutral-100 hover:text-neutral-950 dark:hover:bg-neutral-100/50 aria-expanded:bg-neutral-100 aria-expanded:text-neutral-950 dark:hover:bg-neutral-800 dark:hover:text-neutral-50 dark:dark:hover:bg-neutral-800/50 dark:aria-expanded:bg-neutral-800 dark:aria-expanded:text-neutral-50",
        destructive: "bg-red-500/10 hover:bg-red-500/20 focus-visible:ring-red-500/20 dark:focus-visible:ring-red-500/40 dark:bg-red-500/20 text-red-500 focus-visible:border-red-500/40 dark:hover:bg-red-500/30 dark:bg-red-900/10 dark:hover:bg-red-900/20 dark:focus-visible:ring-red-900/20 dark:dark:focus-visible:ring-red-900/40 dark:dark:bg-red-900/20 dark:text-red-900 dark:focus-visible:border-red-900/40 dark:dark:hover:bg-red-900/30",
        link: "text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-50",
      },
      size: {
        default: "h-9 gap-1.5 px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),8px)] px-2 text-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-[min(var(--radius-md),10px)] px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5",
        lg: "h-10 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-9",
        "icon-xs": "size-6 rounded-[min(var(--radius-md),8px)] in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-md",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
