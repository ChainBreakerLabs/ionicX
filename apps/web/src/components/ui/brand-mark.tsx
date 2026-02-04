import { cn } from "../../lib/utils";

interface BrandMarkProps {
    className?: string;
    size?: "sm" | "md" | "lg";
}

const sizeMap = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
};

export default function BrandMark({ className, size = "md" }: BrandMarkProps) {
    return (
        <div className={cn("flex items-center gap-2", className)}>
            <span className={cn("font-semibold leading-none text-brand-gradient", sizeMap[size])}>ionic</span>
            <span className={cn("font-semibold leading-none", sizeMap[size], "text-slate-600")}>X</span>
        </div>
    );
}
