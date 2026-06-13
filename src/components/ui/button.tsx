"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[9999px] border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap outline-none select-none transition-all duration-150 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 enabled:hover:scale-[1.05] enabled:active:scale-[0.95] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[#9fe870] text-[#163300] hover:bg-[#8DD85F] hover:shadow-[0_4px_20px_rgba(159,232,112,0.3)]",
        outline:
          "border-[rgba(14,15,12,0.12)] bg-white text-[#0e0f0c] hover:bg-[#f4f5f2] dark:border-[rgba(255,255,255,0.1)] dark:bg-[#1a1b18] dark:text-[#f4f5f2] dark:hover:bg-white/5",
        secondary:
          "bg-[rgba(22,51,0,0.08)] text-[#0e0f0c] hover:bg-[rgba(22,51,0,0.12)] dark:bg-white/8 dark:text-[#f4f5f2] dark:hover:bg-white/12",
        ghost:
          "text-[#454745] hover:bg-[#f4f5f2] hover:text-[#0e0f0c] aria-expanded:bg-[#f4f5f2] dark:text-[#868685] dark:hover:bg-white/5 dark:hover:text-[#f4f5f2]",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "scale-100 rounded-none text-primary underline-offset-4 hover:scale-100 hover:underline active:scale-100",
      },
      size: {
        default:
          "h-9 gap-1.5 px-4 py-1.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-full px-3 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-full px-3.5 text-[0.8rem] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-1.5 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-9 rounded-full",
        "icon-xs":
          "size-7 rounded-full [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 rounded-full",
        "icon-lg": "size-11 rounded-full",
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
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
