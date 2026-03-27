import * as React from "react"
import { cn } from "@/lib/utils"

const Badge = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "success" | "warning" | "destructive" | "outline" }
>(({ className, variant = "default", ...props }, ref) => {
    return (
        <div
            ref={ref}
            className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                {
                    "border-transparent bg-primary text-primary-foreground hover:bg-primary/80": variant === "default",
                    "border-transparent bg-green-500 text-white": variant === "success",
                    "border-transparent bg-amber-500 text-white": variant === "warning",
                    "border-transparent bg-red-500 text-white hover:bg-destructive/80": variant === "destructive",
                    "text-foreground": variant === "outline"
                },
                className
            )}
            {...props}
        />
    )
})
Badge.displayName = "Badge"

export { Badge }
