import { Outlet } from "react-router-dom";
import { ChevronDown, LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/BrandMark";

export function SuperAdminShell() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-primary-dark text-white shadow-[0_8px_30px_-24px_rgba(7,24,40,0.8)]">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-4 sm:px-6">
          <BrandLogo size={36} inverse subtitle="Platform administration" />

          <div className="ml-auto relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex min-h-10 items-center gap-2 rounded-lg py-1 pl-2 pr-1 hover:bg-white/10"
              aria-label="Open platform account menu"
              aria-expanded={menuOpen}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-xs font-bold text-primary-dark">
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
      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
