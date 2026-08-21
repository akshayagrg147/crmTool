import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  History,
  Loader2,
  Lock,
  Phone,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandMark";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_LOGIN_COUNTRY, LOGIN_COUNTRIES } from "@/lib/countries";

const CAPABILITIES = [
  {
    icon: UsersRound,
    title: "Clear team accountability",
    description: "Route every lead with ownership that stays visible.",
  },
  {
    icon: History,
    title: "A complete customer record",
    description: "Keep calls, categories, assignments, and outcomes together.",
  },
  {
    icon: ShieldCheck,
    title: "Controls built around roles",
    description: "Give admins, managers, and telecallers the access they need.",
  },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [countryCode, setCountryCode] = useState(DEFAULT_LOGIN_COUNTRY.code);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const country = LOGIN_COUNTRIES.find((item) => item.code === countryCode) ?? DEFAULT_LOGIN_COUNTRY;
      const user = await login(phone, password, country.dialCode);
      if (user.role === "super_admin") navigate("/super-admin");
      else if (user.role === "telecaller") navigate("/leads");
      else navigate("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Something went wrong. Please try again.");
      setShakeKey((key) => key + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)]">
      <aside className="heritage-panel relative hidden min-h-screen overflow-hidden text-white lg:flex lg:flex-col">
        <div className="absolute inset-y-0 right-[14%] w-px bg-white/[0.06]" aria-hidden="true" />
        <div className="absolute inset-y-0 right-[14%] w-24 border-x border-white/[0.035]" aria-hidden="true" />
        <div className="absolute bottom-0 right-0 h-48 w-48 border-l border-t border-accent/25" aria-hidden="true" />

        <div className="login-brand-inner relative z-10 flex h-full flex-1 flex-col px-12 py-10 xl:px-16 xl:py-12">
          <BrandLogo size={44} inverse />

          <div className="login-brand-content my-auto max-w-[36rem] py-14">
            <div className="mb-7 flex items-center gap-3">
              <span className="h-px w-11 bg-accent" aria-hidden="true" />
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-accent-soft">
                The operating desk for your team
              </span>
            </div>

            <h1 className="login-brand-heading max-w-[34rem] font-serif text-[3.4rem] font-semibold leading-[1.04] tracking-[-0.035em] text-white xl:text-[4.15rem]">
              Built for enduring customer relationships.
            </h1>
            <p className="login-brand-copy mt-6 max-w-lg text-[15px] leading-7 text-white/[0.68]">
              One dependable workspace for lead ownership, calling discipline, order visibility,
              and the decisions that move your business forward.
            </p>

            <div className="login-capabilities mt-10 grid max-w-xl gap-1 border-y border-white/10 py-3">
              {CAPABILITIES.map((capability) => (
                <div
                  key={capability.title}
                  className="login-capability grid grid-cols-[42px_1fr] items-start gap-3 rounded-lg px-2 py-3.5"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.055] text-accent-soft">
                    <capability.icon size={17} strokeWidth={1.8} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{capability.title}</p>
                    <p className="mt-1 text-xs leading-5 text-white/[0.55]">{capability.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="login-brand-footer flex items-center justify-between border-t border-white/10 pt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            <span>Role-based workspace</span>
            <span>&copy; {new Date().getFullYear()} TalkoCRM</span>
          </div>
        </div>
      </aside>

      <main className="relative flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary to-accent lg:hidden" aria-hidden="true" />

        <div className="w-full max-w-[440px]">
          <BrandLogo size={43} className="mb-10 lg:hidden" />

          <div className="mb-7">
            <p className="page-eyebrow">Secure workspace access</p>
            <h2 className="mt-3 font-serif text-[2.25rem] font-semibold leading-tight tracking-[-0.025em] text-ink-900">
              Welcome back
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-500">
              Enter your registered details to continue to your workspace.
            </p>
          </div>

          <form
            key={shakeKey}
            onSubmit={onSubmit}
            className={`rounded-[12px] border border-ink-100 bg-white p-5 shadow-card sm:p-7 ${error ? "animate-shake" : ""}`}
            aria-describedby={error ? "login-error" : undefined}
          >
            {error && (
              <div
                id="login-error"
                role="alert"
                className="mb-5 flex items-start gap-2.5 rounded-lg border border-danger/20 bg-danger/[0.07] px-3.5 py-3 text-sm leading-5 text-danger"
              >
                <ShieldCheck className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="login-country" className="mb-2 block text-xs font-semibold text-ink-700">
                Country
              </label>
              <select
                id="login-country"
                name="country"
                className="input min-h-11 w-full"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                autoComplete="country"
              >
                {LOGIN_COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.flag} {country.name} ({country.dialCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5">
              <label htmlFor="login-phone" className="mb-2 block text-xs font-semibold text-ink-700">
                Phone number
              </label>
              <div className="flex">
                <div
                  className="flex min-h-11 shrink-0 items-center rounded-l-lg border border-r-0 border-ink-200 bg-ink-50 px-3 text-sm font-semibold text-ink-600"
                  aria-hidden="true"
                >
                  {LOGIN_COUNTRIES.find((item) => item.code === countryCode)?.dialCode ?? DEFAULT_LOGIN_COUNTRY.dialCode}
                </div>
                <div className="relative min-w-0 flex-1">
                  <Phone
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300"
                    aria-hidden="true"
                  />
                  <input
                    id="login-phone"
                    name="phone"
                    className="input min-h-11 w-full rounded-l-none pl-10"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    required
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Enter your phone number"
                  />
                </div>
              </div>
              <p className="mt-1.5 text-[11px] text-ink-500">Use the number registered with your organization.</p>
            </div>

            <div className="mt-5">
              <label htmlFor="login-password" className="mb-2 block text-xs font-semibold text-ink-700">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={17}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300"
                  aria-hidden="true"
                />
                <input
                  id="login-password"
                  name="password"
                  className="input min-h-11 px-10"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="focus-ring absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-primary-soft hover:text-primary"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary mt-6 min-h-11 w-full"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in securely
                  <ArrowRight size={17} aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 flex items-start gap-2.5 px-1 text-xs leading-5 text-ink-500">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-secondary" aria-hidden="true" />
            <p>No public sign-up — accounts are created by your organization&apos;s administrator.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
