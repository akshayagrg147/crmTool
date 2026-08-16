import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users2,
  BarChart3,
  Contact,
  MessageSquareText,
  Plug,
  Search,
  Settings,
  RefreshCw,
  ChevronDown,
  LogOut,
  Menu,
  X,
  PhoneCall,
  ArchiveX,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { SettingsModal } from "@/components/SettingsModal";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "manager", "telecaller"] },
  { to: "/leads", label: "Leads", icon: Contact, roles: ["admin", "manager", "telecaller"] },
  { to: "/follow-ups", label: "Follow-ups", icon: MessageSquareText, roles: ["admin", "manager", "telecaller"] },
  { to: "/lost-deals", label: "Lost Deals", icon: ArchiveX, roles: ["admin", "manager"] },
  { to: "/team", label: "Team", icon: Users2, roles: ["admin", "manager"] },
  { to: "/integrations", label: "Lead Sources", icon: Plug, roles: ["admin", "manager"] },
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
  const currentNav = visibleNav.find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));

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
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-ink-100/80">
        <div className="flex items-center gap-3 px-4 sm:px-6 h-[72px]">
          <button
            className="md:hidden text-ink-700 p-1.5 -ml-1.5 rounded-lg hover:bg-ink-100 transition-colors"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2 shrink-0 md:hidden">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center text-white shadow-sm">
              <PhoneCall size={16} />
            </div>
            <span className="font-display font-semibold text-ink-900 hidden sm:block">
              {organizationName ?? "DistriCall"}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-3 shrink-0 min-w-[210px]">
            <div className="h-9 w-9 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
              {currentNav ? <currentNav.icon size={18} /> : <PhoneCall size={18} />}
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-900 leading-tight">{currentNav?.label ?? "Workspace"}</p>
              <p className="text-[11px] text-ink-500 mt-0.5">{organizationName ?? "DistriCall"}</p>
            </div>
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

          <div className="hidden lg:flex items-center gap-2 rounded-xl border border-ink-100 bg-ink-50/70 px-3 py-2 text-xs text-ink-600">
            <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_0_3px_rgba(5,150,105,0.12)]" />
            <span className="font-semibold text-ink-700">Today&apos;s lead queue</span>
            <span className="rounded-md bg-white px-1.5 py-0.5 font-bold text-primary shadow-sm">Live</span>
          </div>

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

            <div className="hidden lg:block text-right leading-tight ml-2 mr-1">
              <p className="text-xs font-bold text-ink-900">{user?.name ?? "Workspace user"}</p>
              <p className="text-[10px] text-ink-500 capitalize mt-0.5">{user?.role?.replace("_", " ") ?? "Member"}</p>
            </div>
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
        {/* Desktop workspace sidebar */}
        <div className="hidden md:flex shrink-0 border-r border-ink-100/80 bg-surface">
          <div className="flex w-[68px] flex-col items-center border-r border-ink-100/80 py-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center text-white shadow-sm shadow-primary/20">
              <PhoneCall size={18} />
            </div>
            <div className="mt-8 flex flex-col items-center gap-2">
              {visibleNav.map((item) => (
                <NavLink
                  key={`rail-${item.to}`}
                  to={item.to}
                  aria-label={item.label}
                  className={({ isActive }) =>
                    `flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 ${
                      isActive ? "bg-primary/10 text-primary shadow-sm" : "text-ink-300 hover:bg-ink-50 hover:text-ink-700"
                    }`
                  }
                >
                  <item.icon size={18} />
                </NavLink>
              ))}
            </div>
            <div className="mt-auto flex flex-col items-center gap-2">
              <div className="h-px w-8 bg-ink-100" />
              <button className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-300 transition-colors hover:bg-ink-50 hover:text-ink-700" onClick={() => setShowSettings(true)} title="Settings">
                <Settings size={18} />
              </button>
            </div>
          </div>
          <nav className="flex w-56 flex-col py-5">
            <div className="px-5 pb-5 border-b border-ink-100/80">
              <div className="min-w-0">
                <p className="font-display font-bold text-ink-900 tracking-[-0.02em]">DistriCall</p>
                <p className="text-[11px] text-ink-500 truncate mt-0.5">{organizationName ?? "Sales workspace"}</p>
              </div>
            </div>
            <div className="px-3 pt-5">
              <p className="px-3 mb-2 text-[10px] font-bold tracking-[0.14em] text-ink-300 uppercase">Workspace</p>
              <div className="flex flex-col gap-1">
                {visibleNav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                        isActive ? "bg-primary/10 text-primary shadow-sm" : "text-ink-500 hover:bg-ink-50 hover:text-ink-900"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary" />}
                        <item.icon size={18} className="shrink-0" />
                        <span>{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
            <div className="mt-auto px-3">
              <div className="rounded-2xl bg-ink-50/80 border border-ink-100/80 p-3.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-ink-700">
                  <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_0_3px_rgba(5,150,105,0.12)]" />
                  Workspace online
                </div>
                <p className="text-[11px] text-ink-500 leading-relaxed mt-2">Your team data is synced and protected.</p>
              </div>
            </div>
          </nav>
        </div>

        {/* Mobile drawer */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-ink-900/40 animate-fade-in" onClick={() => setMobileNavOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-surface p-4 shadow-popover animate-slide-in-left">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center text-white"><PhoneCall size={15} /></div>
                  <div>
                    <span className="font-display font-bold text-ink-900 block leading-tight">DistriCall</span>
                    <span className="text-[10px] text-ink-500">{organizationName ?? "Workspace"}</span>
                  </div>
                </div>
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

        <main className="flex-1 min-w-0 pb-20 md:pb-8">
          <div key={location.pathname} className="px-4 sm:px-7 lg:px-9 py-6 lg:py-8 max-w-[1500px] mx-auto animate-fade-in-up">
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
