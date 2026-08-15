import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneCall, Lock, Phone, MapPinned, IndianRupee, ShieldCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const FEATURES = [
  { icon: MapPinned, title: "City-first routing", desc: "State and city, tracked on every lead." },
  { icon: IndianRupee, title: "Order & credit tracking", desc: "See outstanding vs. credit limit at a glance." },
  { icon: ShieldCheck, title: "Compliance-ready calling", desc: "DND flags surface before every call." },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const user = await login(phone, password);
      if (user.role === "super_admin") navigate("/super-admin");
      else if (user.role === "telecaller") navigate("/leads");
      else navigate("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Something went wrong. Please try again.");
      setShakeKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-bg">
      {/* Branding panel — desktop only */}
      <div className="hidden lg:flex lg:w-[46%] relative overflow-hidden bg-gradient-primary">
        <div
          className="absolute -top-24 -left-16 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-float"
          aria-hidden
        />
        <div
          className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-ink-900/10 blur-3xl animate-float-slow"
          aria-hidden
        />
        <div
          className="absolute top-1/3 right-10 h-24 w-24 rounded-3xl bg-white/10 backdrop-blur-sm animate-float-slow"
          style={{ animationDelay: "1s" }}
          aria-hidden
        />

        <div className="relative flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-2.5 animate-fade-in-down">
            <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <PhoneCall size={18} />
            </div>
            <span className="font-display text-lg font-semibold">DistriCall</span>
          </div>

          <div className="max-w-md">
            <h1
              className="text-4xl font-display font-semibold leading-[1.15] mb-4 animate-fade-in-up"
              style={{ animationDelay: "80ms" }}
            >
              Run your distribution team like clockwork.
            </h1>
            <p
              className="text-white/80 text-[15px] leading-relaxed mb-10 animate-fade-in-up"
              style={{ animationDelay: "150ms" }}
            >
              Built for pharma telecalling teams — city-aware lead routing, order tracking,
              and compliance in one workspace.
            </p>

            <div className="flex flex-col gap-5">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  className="flex items-start gap-3.5 animate-fade-in-up"
                  style={{ animationDelay: `${220 + i * 90}ms` }}
                >
                  <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0">
                    <f.icon size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{f.title}</p>
                    <p className="text-white/70 text-xs mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-white/50 text-xs animate-fade-in" style={{ animationDelay: "500ms" }}>
            &copy; {new Date().getFullYear()} DistriCall. All rights reserved.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm animate-fade-in-up">
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center text-white mb-3 shadow-md">
              <PhoneCall size={22} />
            </div>
            <h1 className="text-2xl font-display font-semibold text-ink-900">DistriCall</h1>
            <p className="text-sm text-ink-500 mt-1">Sign in to your workspace</p>
          </div>

          <div className="hidden lg:block mb-8">
            <h2 className="text-2xl font-display font-semibold text-ink-900">Welcome back</h2>
            <p className="text-sm text-ink-500 mt-1">Sign in to your workspace</p>
          </div>

          <form onSubmit={onSubmit} key={shakeKey} className="card p-6 flex flex-col gap-4 animate-shake">
            {error && (
              <div className="rounded-xl bg-danger/10 text-danger text-sm px-3.5 py-2.5 animate-fade-in">{error}</div>
            )}
            <div>
              <label className="text-xs font-medium text-ink-500 mb-1.5 block">Phone number</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                <input
                  className="input pl-9"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9999900001"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-ink-500 mb-1.5 block">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                <input
                  className="input pl-9"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <p className="text-center text-xs text-ink-300 mt-6">
            No public sign-up — accounts are created by your organization's admin.
          </p>
        </div>
      </div>
    </div>
  );
}
