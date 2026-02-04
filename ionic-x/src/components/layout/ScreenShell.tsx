import { useState } from "react";
import Nav from "../ui/nav";
import SideMenu from "../ui/side-menu";
import LiveOutputBar from "../live/LiveOutputBar";

interface ScreenShellProps {
  children: React.ReactNode;
}

export default function ScreenShell({ children }: ScreenShellProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Nav onToggleMenu={() => setIsMenuOpen(true)} />
      <SideMenu open={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      <LiveOutputBar />
      <main className="relative flex-1 overflow-y-auto min-h-0">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 left-10 h-48 w-48 rounded-full bg-amber-200/40 blur-3xl" />
          <div className="absolute top-32 right-10 h-64 w-64 rounded-full bg-emerald-200/40 blur-3xl" />
          <div className="absolute bottom-20 left-1/3 h-40 w-40 rounded-full bg-rose-200/30 blur-3xl" />
        </div>
        <div className="relative mx-auto flex w-full max-w-none px-6 py-10">{children}</div>
      </main>
      <footer className="w-full border-t border-white/60 bg-white/70 px-6 py-4 text-center text-xs text-slate-500 shadow-sm backdrop-blur-xl">
        © 2026 IonicX · Diseñado para presentaciones en vivo con sincronía local.
      </footer>
    </div>
  );
}
