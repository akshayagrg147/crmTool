import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users2,
  BarChart3,
  Contact,
  MessageSquareText,
  Search,
  Settings,
  RefreshCw,
  ChevronDown,
  LogOut,
  Menu,
  X,
  PhoneCall,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { SettingsModal } from "@/components/SettingsModal";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "manager", "telecaller"] },
  { to: "/leads", label: "Leads", icon: Contact, roles: ["admin", "manager", "telecaller"] },
  { to: "/follow-ups", label: "Follow-ups", icon: MessageSquareText, roles: ["admin", "manager", "telecaller"] },
  { to: "/team", label: "Team", icon: Users2, roles: ["admin", "manager"] },
  { to: "/analytics", label: "Analytics", icon: BarChart3, roles: ["admin", "manager", "telecaller"] },
];

export function ImpersonationBanner() {
  const { isImpersonating, impersonatedByName, organizationName, exitImpersonation } = useAuth();
  if (!isImpersonating) return null;
  return (
    <div className="bg-ink-900 text-white text-sm px-4 py-2 flex items-center justify-center gap-3 sticky top-0 z-[60] animate-fade-in-down">
      <span>
        Viewing as: <strong>{organizationName ?? "Org"} — Admin</strong> — impersonated by{" "}
        {impersonatedByName ?? "Super Admin"}
      </span>
      <button
        onClick={exitImpersonation}
        className="underline decoration-white/40 hover:decoration-white font-medium transition-colors"
      >
        Exit impersonation
      </button>
    </div>
  );
}

export function AppShell() {
  const { user, organizationName, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const visibleNav = navItems.filter((item) => !user || item.roles.includes(user.role));

  function onSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const q = (form.get("q") as string) || "";
    if (q.trim()) navigate(`/leads?q=${encodeURIComponent(q.trim())}`);
  }

  function onRefresh() {
    setRefreshing(true);
    queryClient.invalidateQueries();
    setTimeout(() => setRefreshing(false), 600);
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <ImpersonationBanner />

      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-sm border-b border-ink-100">
        <div className="flex items-center gap-3 px-4 sm:px-6 h-16">
          <button
            className="md:hidden text-ink-700 p-1.5 -ml-1.5 rounded-lg hover:bg-ink-100 transition-colors"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center text-white shadow-sm">
              <PhoneCall size={16} />
            </div>
            <span className="font-display font-semibold text-ink-900 hidden sm:block">
              {organizationName ?? "DistriCall"}
            </span>
          </div>

          <form onSubmit={onSearchSubmit} className="flex-1 max-w-md ml-2 hidden sm:block">
            <div className="relative group">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300 group-focus-within:text-primary transition-colors"
              />
              <input
                name="q"
                placeholder="Search leads by name or phone..."
                className="input pl-9 py-2 bg-bg border-transparent focus:bg-white transition-colors duration-200"
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1">
            <button
              className="p-2 rounded-full hover:bg-ink-100 text-ink-500 transition-all duration-200 active:scale-90"
              onClick={onRefresh}
              title="Refresh"
            >
              <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
            </button>
            <NotificationsDropdown />
            <button
              className="p-2 rounded-full hover:bg-ink-100 text-ink-500 transition-all duration-200 active:scale-90"
              title="Settings"
              onClick={() => setShowSettings(true)}
            >
              <Settings size={18} />
            </button>

            <div className="relative ml-1">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-ink-100 transition-colors duration-200"
              >
                <div className="h-8 w-8 rounded-full bg-gradient-primary text-white flex items-center justify-center text-xs font-semibold shadow-sm">
                  {user?.name?.slice(0, 2).toUpperCase() ?? "??"}
                </div>
                <ChevronDown
                  size={14}
                  className={`text-ink-500 hidden sm:block transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
                />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 card p-1.5 z-20 shadow-popover origin-top-right animate-scale-in">
                    <div className="px-3 py-2">
                      <p className="text-sm font-semibold text-ink-900">{user?.name}</p>
                      <p className="text-xs text-ink-500 capitalize">{user?.role?.replace("_", " ")}</p>
                    </div>
                    <div className="h-px bg-ink-100 my-1" />
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger rounded-lg hover:bg-danger/5 transition-colors duration-150"
                    >
                      <LogOut size={16} /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop icon rail */}
        <nav className="hidden md:flex flex-col items-center gap-1 w-16 shrink-0 border-r border-ink-100 bg-surface py-4">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-1 w-12 py-2.5 rounded-xl text-[10px] font-medium transition-all duration-200 ${
                  isActive ? "bg-primary/10 text-primary" : "text-ink-500 hover:bg-ink-100 hover:text-ink-700"
                }`
              }
              title={item.label}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute -left-2 top-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-gradient-primary animate-fade-in" />
                  )}
                  <item.icon size={19} className="transition-transform duration-200" />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Mobile drawer */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-ink-900/40 animate-fade-in" onClick={() => setMobileNavOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-64 bg-surface p-4 shadow-popover animate-slide-in-left">
              <div className="flex items-center justify-between mb-6">
                <span className="font-display font-semibold">{organizationName ?? "DistriCall"}</span>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="p-1 rounded-lg hover:bg-ink-100 transition-colors active:scale-90"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {visibleNav.map((item, i) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileNavOpen(false)}
                    style={{ animationDelay: `${i * 40}ms` }}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 animate-slide-in-left ${
                        isActive ? "bg-primary/10 text-primary" : "text-ink-700 hover:bg-ink-100"
                      }`
                    }
                  >
                    <item.icon size={18} /> {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 min-w-0 pb-20 md:pb-6">
          <div key={location.pathname} className="px-4 sm:px-6 py-5 max-w-[1400px] mx-auto animate-fade-in-up">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-sm border-t border-ink-100 flex items-stretch">
        {visibleNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors duration-200 ${
                isActive ? "text-primary" : "text-ink-500"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={19} className={`transition-transform duration-200 ${isActive ? "-translate-y-0.5" : ""}`} />
                {item.label}
                {isActive && <span className="h-1 w-1 rounded-full bg-primary animate-fade-in" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
