import { Outlet } from "react-router-dom";
import { ChevronDown, LogOut, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function SuperAdminShell() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 bg-ink-900 text-white">
        <div className="flex items-center gap-3 px-6 h-16 max-w-[1400px] mx-auto">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <ShieldCheck size={16} />
          </div>
          <div>
            <p className="font-display font-semibold leading-tight">DistriCall</p>
            <p className="text-[11px] text-white/50 leading-tight">Super Admin</p>
          </div>

          <div className="ml-auto relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-white/10"
            >
              <div className="h-8 w-8 rounded-full bg-gradient-primary text-white flex items-center justify-center text-xs font-semibold">
                {user?.name?.slice(0, 2).toUpperCase() ?? "SA"}
              </div>
              <ChevronDown size={14} className="text-white/70" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 card p-1.5 z-20 shadow-popover text-ink-900">
                  <div className="px-3 py-2">
                    <p className="text-sm font-semibold">{user?.name}</p>
                    <p className="text-xs text-ink-500">Platform Owner</p>
                  </div>
                  <div className="h-px bg-ink-100 my-1" />
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger rounded-lg hover:bg-danger/5"
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="px-6 py-6 max-w-[1400px] mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
