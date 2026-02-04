import { Music, Search, X, Image } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

interface SideMenuProps {
    open: boolean;
    onClose: () => void;
}

export default function SideMenu({ open, onClose }: SideMenuProps) {
    const location = useLocation();
    const navigate = useNavigate();

    const menuItems = [
        { label: "Búsqueda", icon: Search, path: "/" },
        { label: "Letras", icon: Music, path: "/letras" },
        { label: "Portadas", icon: Image, path: "/portadas" },
    ];

    const handleNavigate = (path: string) => {
        navigate(path);
        onClose();
    };

    return (
        <div className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`}>
            <div
                className={`absolute inset-0 bg-slate-900/20 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />
            <aside
                className={`absolute left-0 top-0 h-full w-72 bg-white/95 shadow-xl backdrop-blur-xl transition-transform ${
                    open ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="flex items-center border-b border-slate-200 px-5 py-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Menú</p>
                </div>
                <div className="flex h-full flex-col justify-between p-5">
                    <nav className="flex flex-col gap-2">
                        {menuItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.path;
                            return (
                                <button
                                    key={item.label}
                                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                                        isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                    type="button"
                                    onClick={() => handleNavigate(item.path)}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                    <div className="flex flex-col gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                        >
                            <X className="h-4 w-4" />
                            Cerrar menú
                        </button>
                    </div>
                </div>
            </aside>
        </div>
    );
}
