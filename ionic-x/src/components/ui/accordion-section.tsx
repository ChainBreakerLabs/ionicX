import { useId } from "react";
import { ChevronDown } from "lucide-react";

interface AccordionSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function AccordionSection({
  title,
  icon,
  defaultOpen = false,
  children,
}: AccordionSectionProps) {
  const id = useId();
  return (
    <details
      className="group rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
        <div className="flex items-center gap-2">
          {icon}
          <span>{title}</span>
        </div>
        <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-4" id={id}>
        {children}
      </div>
    </details>
  );
}
