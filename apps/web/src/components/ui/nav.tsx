import BrandMark from "./brand-mark";
import { Menu } from "lucide-react";

interface NavProps {
    onToggleMenu?: () => void;
}

export default function Nav({ onToggleMenu }: NavProps) {
    return (
        <nav className="sticky top-0 z-30 border-b border-white/60 bg-white/70 backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-none items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4">
                    {onToggleMenu && (
                        <button
                            type="button"
                            onClick={onToggleMenu}
                            className="rounded-full border border-slate-200 bg-white/80 p-2 text-slate-600 shadow-sm hover:bg-white"
                            aria-label="Abrir menú"
                        >
                            <Menu className="h-4 w-4" />
                        </button>
                    )}
                    <BrandMark size="md" />
                    <p className="hidden sm:block text-xs uppercase tracking-[0.3em] text-slate-400">Estudio en vivo</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                        Sincronía lista
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-slate-500">
                        versión 1.0
                    </span>
                </div>
            </div>
        </nav>
    );
}
