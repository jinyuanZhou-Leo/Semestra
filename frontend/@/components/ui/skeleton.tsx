import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-neutral-100 rounded-md animate-pulse dark:bg-neutral-800", className)}
      {...props}
    />
  )
}

export { Skeleton }
