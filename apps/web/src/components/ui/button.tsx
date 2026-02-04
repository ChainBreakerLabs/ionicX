import * as React from "react"
import { cn } from "../../lib/utils"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    className?: string;
    variant?: 'default' | 'destructive' | 'outline' | 'ghost' | 'secondary';
    size?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
                                                                     className,
                                                                     variant = "default",
                                                                     size = "default",
                                                                     ...props
                                                                 }, ref) => {
    return (
        <button
            className={cn(
                "inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background shadow-sm",
                {
                    "bg-slate-900 text-white hover:bg-slate-800": variant === "default",
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90": variant === "destructive",
                    "border border-slate-200 bg-white/70 text-slate-700 hover:bg-white": variant === "outline",
                    "text-slate-600 hover:bg-slate-100": variant === "ghost",
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80": variant === "secondary",
                    "h-10 py-2 px-4": size === "default",
                    "h-9 px-3 rounded-md": size === "sm",
                    "h-11 px-8 rounded-md": size === "lg",
                },
                className
            )}
            ref={ref}
            {...props}
        />
    )
})

Button.displayName = "Button"

export { Button }
