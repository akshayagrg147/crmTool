import { useEffect, useRef, useState, type FormEvent } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users2,
  BarChart3,
  Contact,
  MessageSquareText,
  ListTodo,
  Plug,
  Search,
  Settings,
  RefreshCw,
  ChevronDown,
  LogOut,
  Menu,
  X,
  ArchiveX,
  ShieldCheck,
  SlidersHorizontal,
  CalendarClock,
  Wallet,
  MessageCircleMore,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/BrandMark";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { SettingsModal } from "@/components/SettingsModal";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "Workspace", roles: ["admin", "manager", "telecaller"] },
  { to: "/leads", label: "Leads", icon: Contact, section: "Workspace", roles: ["admin", "manager", "telecaller"] },
  { to: "/follow-ups", label: "Follow-ups", icon: MessageSquareText, section: "Workspace", roles: ["admin", "manager", "telecaller"] },
  { to: "/tasks", label: "Tasks & Calendar", icon: ListTodo, section: "Workspace", roles: ["admin", "manager", "telecaller"] },
  { to: "/lost-deals", label: "Lost Deals", icon: ArchiveX, section: "Operations", roles: ["admin", "manager"] },
  { to: "/team", label: "Team", icon: Users2, section: "Operations", roles: ["admin", "manager"] },
  { to: "/integrations", label: "Lead Sources", icon: Plug, section: "Operations", roles: ["admin", "manager"] },
  { to: "/attendance", label: "Attendance & Leave", icon: CalendarClock, section: "Operations", roles: ["admin", "manager", "telecaller"] },
  { to: "/payroll", label: "Payroll", icon: Wallet, section: "Operations", roles: ["admin"] },
  { to: "/whatsapp", label: "WhatsApp tracking", icon: MessageCircleMore, section: "Operations", roles: ["admin"] },
  { to: "/workspace-settings", label: "Workspace Controls", icon: SlidersHorizontal, section: "Operations", roles: ["admin", "manager", "telecaller"] },
  { to: "/analytics", label: "Analytics", icon: BarChart3, section: "Intelligence", roles: ["admin", "manager", "telecaller"] },
];

const sections = ["Workspace", "Operations", "Intelligence"] as const;

export function ImpersonationBanner() {
  const { isImpersonating, impersonatedByName, organizationName, exitImpersonation } = useAuth();
  if (!isImpersonating) return null;

  return (
    <div className="sticky top-0 z-[60] flex h-12 items-center justify-center gap-3 overflow-hidden bg-primary-dark px-3 text-center text-[11px] text-white sm:px-4 sm:text-sm">
      <ShieldCheck size={15} className="hidden shrink-0 text-accent sm:block" aria-hidden="true" />
      <span className="truncate" title={`Viewing ${organizationName ?? "Organization"} as Admin on behalf of ${impersonatedByName ?? "Super Admin"}`}>
        Viewing <strong>{organizationName ?? "Organization"} — Admin</strong> on behalf of {impersonatedByName ?? "Super Admin"}
      </span>
      <button
        type="button"
        onClick={exitImpersonation}
        className="shrink-0 rounded-md border border-white/25 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:border-accent hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        Exit view
      </button>
    </div>
  );
}

export function AppShell() {
  const { user, organizationName, organizationLogoUrl, logout, isImpersonating } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  const visibleNav = navItems.filter((item) => !user || item.roles.includes(user.role));
  const currentNav = visibleNav.find(
    (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
  );

  useEffect(() => {
    setMenuOpen(false);
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      mobileDrawerRef.current?.querySelector<HTMLElement>("a[href], button:not([disabled]), input:not([disabled])")?.focus();
    });
    const containKeyboardFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNavOpen(false);
        return;
      }
      if (event.key !== "Tab" || !mobileDrawerRef.current) return;
      const focusable = Array.from(
        mobileDrawerRef.current.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!mobileDrawerRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", containKeyboardFocus);

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", containKeyboardFocus);
      (mobileMenuButtonRef.current ?? previouslyFocused)?.focus();
    };
  }, [mobileNavOpen]);

  function onSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const query = ((form.get("q") as string) || "").trim();
    if (query) navigate(`/leads?q=${encodeURIComponent(query)}`);
  }

  function onRefresh() {
    setRefreshing(true);
    void queryClient.invalidateQueries();
    window.setTimeout(() => setRefreshing(false), 600);
  }

  const renderNav = (mobile = false) => (
    <div className="space-y-5">
      {sections.map((section) => {
        const items = visibleNav.filter((item) => item.section === section);
        if (items.length === 0) return null;

        return (
          <div key={section}>
            <p className={`mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.17em] ${mobile ? "text-white/40" : "text-white/35"}`}>
              {section}
            </p>
            <div className="space-y-1">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={mobile ? () => setMobileNavOpen(false) : undefined}
                  className={({ isActive }) =>
                    `group relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                        : "text-white/60 hover:bg-white/[0.055] hover:text-white"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-accent" />}
                      <item.icon
                        size={18}
                        aria-hidden="true"
                        className={`shrink-0 transition-colors ${isActive ? "text-accent" : "text-white/45 group-hover:text-white/80"}`}
                      />
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-bg">
      <ImpersonationBanner />

      <div className="flex min-h-screen" aria-hidden={mobileNavOpen ? true : undefined}>
        <aside className={`sticky hidden w-[248px] shrink-0 flex-col overflow-hidden bg-primary-dark text-white lg:flex ${isImpersonating ? "top-12 h-[calc(100vh-3rem)]" : "top-0 h-screen"}`}>
          <div className="flex h-16 shrink-0 items-center border-b border-white/[0.08] px-5">
            <BrandLogo size={38} inverse logoUrl={organizationLogoUrl} brandName={organizationName ?? "TalkoCRM"} />
          </div>

          <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto px-3 py-5">
            {renderNav()}
          </nav>

          <div className="shrink-0 border-t border-white/[0.08] p-3">
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="mb-2 flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-white/55 transition-colors hover:bg-white/[0.055] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <Settings size={17} aria-hidden="true" />
              Workspace settings
            </button>
            <div className="rounded-xl border border-white/[0.09] bg-white/[0.055] px-3.5 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#63B08B] shadow-[0_0_0_3px_rgba(99,176,139,0.13)]" />
                <p className="truncate text-xs font-semibold text-white/85">{organizationName ?? "Sales workspace"}</p>
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-white/35">Workspace connected · Data synchronized</p>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className={`sticky z-40 border-b border-ink-100/90 bg-surface/95 backdrop-blur-xl ${isImpersonating ? "top-12" : "top-0"}`}>
            <div className="flex h-16 items-center gap-2.5 px-4 sm:px-6 lg:px-7">
              <button
                ref={mobileMenuButtonRef}
                type="button"
                className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-700 transition-colors hover:bg-primary-soft hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 lg:hidden"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation"
                aria-expanded={mobileNavOpen}
              >
                <Menu size={21} aria-hidden="true" />
              </button>

              <div className="flex min-w-0 items-center gap-2.5 sm:min-w-[150px]">
                <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/10 bg-primary-soft text-primary sm:flex">
                  {currentNav ? <currentNav.icon size={16} aria-hidden="true" /> : <LayoutDashboard size={16} aria-hidden="true" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-tight text-ink-900">{currentNav?.label ?? "Workspace"}</p>
                  <p className="mt-0.5 hidden truncate text-[10px] text-ink-500 sm:block">{organizationName ?? "TalkoCRM"}</p>
                </div>
              </div>

              <form onSubmit={onSearchSubmit} className="ml-2 hidden w-full max-w-[430px] flex-1 md:block">
                <label htmlFor="workspace-search" className="sr-only">Search leads</label>
                <div className="group relative">
                  <Search
                    size={16}
                    aria-hidden="true"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300 transition-colors group-focus-within:text-primary"
                  />
                  <input
                    id="workspace-search"
                    name="q"
                    type="search"
                    autoComplete="off"
                    placeholder="Search leads by name or phone"
                    className="h-10 w-full rounded-lg border border-transparent bg-ink-50 pl-10 pr-3 text-sm text-ink-900 outline-none transition-all placeholder:text-ink-300 hover:border-ink-100 focus:border-primary/30 focus:bg-white focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </form>

              <div className="ml-auto hidden items-center gap-2 rounded-lg border border-ink-100 bg-[#FAFAF7] px-3 py-2 text-xs xl:flex">
                <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_0_3px_rgba(54,120,94,0.12)]" />
                <span className="font-semibold text-ink-700">Today&apos;s lead queue</span>
                <span className="rounded bg-primary-soft px-1.5 py-0.5 font-bold text-primary">Live</span>
              </div>

              <div className="ml-auto flex items-center gap-0.5 xl:ml-2">
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 transition-all hover:bg-primary-soft hover:text-primary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                  onClick={onRefresh}
                  aria-label={refreshing ? "Refreshing workspace data" : "Refresh workspace data"}
                  title="Refresh data"
                >
                  <RefreshCw size={17} aria-hidden="true" className={refreshing ? "animate-spin" : ""} />
                </button>
                <NotificationsDropdown />
                <button
                  type="button"
                  className="hidden h-9 w-9 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-primary-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 sm:flex"
                  aria-label="Open workspace settings"
                  title="Settings"
                  onClick={() => setShowSettings(true)}
                >
                  <Settings size={17} aria-hidden="true" />
                </button>

                <div className="relative ml-1 border-l border-ink-100 pl-2">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((value) => !value)}
                    className="flex min-h-10 items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 text-left transition-colors hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                    aria-label="Open account menu"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white shadow-sm">
                      {user?.name?.slice(0, 2).toUpperCase() ?? "??"}
                    </div>
                    <div className="hidden max-w-32 leading-tight xl:block">
                      <p className="truncate text-xs font-bold text-ink-900">{user?.name ?? "Workspace user"}</p>
                      <p className="mt-0.5 truncate text-[10px] capitalize text-ink-500">{user?.role?.replace("_", " ") ?? "Member"}</p>
                    </div>
                    <ChevronDown
                      size={13}
                      aria-hidden="true"
                      className={`hidden text-ink-500 transition-transform sm:block ${menuOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {menuOpen && (
                    <>
                      <button
                        type="button"
                        className="fixed inset-0 z-10 cursor-default"
                        aria-label="Close account menu"
                        onClick={() => setMenuOpen(false)}
                      />
                      <div
                        role="menu"
                        className="card absolute right-0 z-20 mt-2 w-60 origin-top-right overflow-hidden p-1.5 shadow-popover animate-scale-in"
                      >
                        <div className="px-3 py-2.5">
                          <p className="truncate text-sm font-semibold text-ink-900">{user?.name}</p>
                          <p className="mt-0.5 text-xs capitalize text-ink-500">{user?.role?.replace("_", " ")}</p>
                          <p className="mt-1 truncate text-[11px] text-ink-300">{organizationName ?? "TalkoCRM workspace"}</p>
                        </div>
                        <div className="my-1 h-px bg-ink-100" />
                        <button
                          type="button"
                          role="menuitem"
                          onClick={logout}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/20"
                        >
                          <LogOut size={16} aria-hidden="true" />
                          Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="min-h-[calc(100vh-4rem)] min-w-0">
            <div
              key={location.pathname}
              className="mx-auto max-w-[1600px] px-4 py-6 animate-fade-in sm:px-6 lg:px-8 lg:py-8"
            >
              <Outlet />
            </div>
          </main>
        </section>
      </div>

      {mobileNavOpen && (
        <div className={`fixed z-50 lg:hidden ${isImpersonating ? "inset-x-0 bottom-0 top-12" : "inset-0"}`} role="dialog" aria-modal="true" aria-label="Workspace navigation">
          <button
            type="button"
            className="absolute inset-0 bg-primary-dark/65 backdrop-blur-[2px] animate-fade-in"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          />
          <div ref={mobileDrawerRef} className="absolute inset-y-0 left-0 flex w-[min(88vw,320px)] flex-col overflow-hidden bg-primary-dark text-white shadow-popover animate-slide-in-left">
            <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.08] px-5">
              <BrandLogo
                size={38}
                inverse
                subtitle={organizationName ?? "Conversation-led CRM"}
                logoUrl={organizationLogoUrl}
                brandName={organizationName ?? "TalkoCRM"}
              />
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                aria-label="Close navigation"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <form
              onSubmit={(event) => {
                onSearchSubmit(event);
                setMobileNavOpen(false);
              }}
              className="shrink-0 border-b border-white/[0.08] p-4"
            >
              <label htmlFor="mobile-workspace-search" className="sr-only">Search leads</label>
              <div className="relative">
                <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
                <input
                  id="mobile-workspace-search"
                  name="q"
                  type="search"
                  autoComplete="off"
                  placeholder="Search leads"
                  className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.07] pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-accent/60 focus:bg-white/[0.1] focus:ring-2 focus:ring-accent/20"
                />
              </div>
            </form>

            <nav aria-label="Mobile navigation" className="flex-1 overflow-y-auto px-3 py-5">
              {renderNav(true)}
            </nav>

            <div className="shrink-0 border-t border-white/[0.08] p-3">
              <div className="mb-2 flex items-center gap-3 rounded-lg bg-white/[0.045] px-3 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-bold text-primary-dark">
                  {user?.name?.slice(0, 2).toUpperCase() ?? "??"}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white">{user?.name ?? "Workspace user"}</p>
                  <p className="mt-0.5 text-[10px] capitalize text-white/40">{user?.role?.replace("_", " ") ?? "Member"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavOpen(false);
                    setShowSettings(true);
                  }}
                  className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 text-xs font-semibold text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  <Settings size={15} aria-hidden="true" /> Settings
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 text-xs font-semibold text-white/65 transition-colors hover:border-danger/50 hover:bg-danger/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50"
                >
                  <LogOut size={15} aria-hidden="true" /> Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
