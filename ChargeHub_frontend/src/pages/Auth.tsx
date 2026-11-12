import { useEffect, useState, type InputHTMLAttributes } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Car, Loader2, Lock, Mail, MapPin, Phone, PlugZap, Route, ShieldCheck, User as UserIcon, Wallet, Zap, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PasswordToggle from "@/components/PasswordToggle";
import { Label } from "@/components/ui/label";
import Logo from "@/components/brand/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { authAPI } from "@/services/api";
import { homePath, useAuthStore, type Role, type User } from "@/store/authStore";
import { errorMessage } from "@/lib/format";
import { cn } from "@/lib/utils";
import evBackground from "@/assets/ev-hero-background.webp";

const ROLES: { value: Role; label: string; hint: string; icon: LucideIcon; loginOnly?: boolean }[] = [
  { value: "user", label: "Driver", hint: "Find & book", icon: Car },
  { value: "provider", label: "Provider", hint: "List chargers", icon: PlugZap },
  { value: "admin", label: "Admin", hint: "Manage", icon: ShieldCheck, loginOnly: true },
];

const HIGHLIGHTS = [
  { icon: Route, title: "Road distance & drive time", text: "to every charger around you" },
  { icon: MapPin, title: "Every town and village", text: "search by name or plus code" },
  { icon: ShieldCheck, title: "OTP-verified sessions", text: "pay the provider at the station" },
];

const EMPTY = { name: "", email: "", password: "", confirmPassword: "", phone: "", location: "", upiId: "" };
type FieldName = keyof typeof EMPTY;

const Field = ({ id, label, icon: Icon, trailing, ...props }: { id: string; label: string; icon: LucideIcon; trailing?: React.ReactNode } & InputHTMLAttributes<HTMLInputElement>) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</Label>
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input id={id} className="pl-10 pr-10" {...props} />
      {trailing && <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>}
    </div>
  </div>
);

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
  </svg>
);

const Auth = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, login } = useAuthStore();

  const [isLogin, setIsLogin] = useState(searchParams.get("mode") !== "register");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>((searchParams.get("type") as Role) || "user");
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (searchParams.get("expired")) toast.info("Your session expired. Please sign in again.");
  }, [searchParams]);

  // Signed in (now or already): back to the page that required login (e.g. booking from the map), or the dashboard
  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    const allowed = from && (from.startsWith(`/${user.role}/`) || from.startsWith("/stations"));
    return <Navigate to={allowed ? from : homePath(user.role)} replace />;
  }

  const bind = (name: FieldName) => ({
    value: form[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [name]: e.target.value }),
  });

  const switchMode = (login: boolean) => {
    setIsLogin(login);
    if (!login && role === "admin") setRole("user");
  };

  // Saving the session re-renders this page, which then redirects (see above)
  const finishLogin = (data: { user: User; token: string }, message: string) => {
    login(data.user, data.token);
    toast.success(message);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin && form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      if (isLogin) {
        const { data } = await authAPI.login(form.email, form.password);
        if (data.data.user.role !== role) {
          toast.error(`This account is registered as ${data.data.user.role}. Please select "${data.data.user.role}".`);
          return;
        }
        finishLogin(data.data, `Welcome back, ${data.data.user.name}!`);
      } else {
        const { data } = await authAPI.register({
          name: form.name,
          email: form.email,
          password: form.password,
          role: role === "provider" ? "provider" : "user",
          phone: form.phone || undefined,
          businessInfo: role === "provider" ? { location: form.location, upiId: form.upiId } : undefined,
        });
        finishLogin(data.data, `Account created. Welcome, ${data.data.user.name}!`);
      }
    } catch (error) {
      toast.error(errorMessage(error, "Authentication failed. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setIsLoading(true);
    try {
      const { getGoogleIdToken } = await import("@/lib/firebase");
      const idToken = await getGoogleIdToken();
      const { data } = await authAPI.googleAuth(idToken, role === "provider" ? "provider" : "user");
      finishLogin(data.data, `Welcome, ${data.data.user.name}!`);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        toast.error(errorMessage(error, "Google sign-in failed. Please try again."));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const passwordToggle = <PasswordToggle shown={showPassword} onToggle={() => setShowPassword(!showPassword)} />;
  const passwordType = showPassword ? "text" : "password";
  const roles = ROLES.filter((r) => isLogin || !r.loginOnly);

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand side */}
      <aside className="relative hidden overflow-hidden border-r border-border/70 bg-card lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-cover bg-center opacity-25" style={{ backgroundImage: `url(${evBackground})` }} />
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/80 to-primary/20" />
        <div className="bg-grid absolute inset-0" />
        <svg className="pointer-events-none absolute bottom-40 left-0 h-40 w-full opacity-70" viewBox="0 0 600 160" preserveAspectRatio="none" aria-hidden>
          <path d="M0 120 C 150 120, 180 30, 320 50 S 480 140, 600 40" fill="none" stroke="hsl(var(--primary) / 0.6)" strokeWidth="2" className="flow-line" />
        </svg>

        <Logo className="relative" />
        <div className="relative max-w-md space-y-8">
          <h2 className="text-4xl font-bold leading-tight xl:text-5xl">
            Power up <br /> <span className="text-gradient">every journey.</span>
          </h2>
          <ul className="space-y-4">
            {HIGHLIGHTS.map((item, i) => (
              <li key={item.title} className="enter flex items-center gap-4" style={{ animationDelay: `${150 + i * 100}ms` }}>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold">{item.title}</span>
                  <span className="text-sm text-muted-foreground">{item.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">Tamil Nadu first · every town and village in India</p>
      </aside>

      {/* Form side */}
      <main className="relative flex flex-col px-4 py-5 sm:px-8">
        <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-primary/10 blur-[100px]" />
        <div className="relative flex items-center justify-between">
          <Logo className="lg:hidden" />
          <Link to="/" className="hidden items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground lg:inline-flex">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <ThemeToggle />
        </div>

        <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
          <div className="enter mb-7">
            <h1 className="text-3xl font-bold">{isLogin ? "Welcome back" : "Create your account"}</h1>
            <p className="mt-1.5 text-muted-foreground">{isLogin ? "Sign in to book chargers and manage your sessions." : "Join in seconds — it's free for drivers and providers."}</p>
          </div>

          {/* Sign in / Register switch */}
          <div className="relative mb-6 grid grid-cols-2 rounded-xl border border-border/70 bg-muted/50 p-1 text-sm font-semibold">
            <span className={cn("absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-card shadow transition-transform duration-300", !isLogin && "translate-x-full")} />
            {[true, false].map((login) => (
              <button key={String(login)} type="button" onClick={() => switchMode(login)} className={cn("relative z-10 py-2 transition-colors", isLogin === login ? "text-foreground" : "text-muted-foreground")}>
                {login ? "Sign in" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-muted-foreground">I am a</legend>
              <div className={cn("grid gap-2", roles.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
                {roles.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    aria-pressed={role === r.value}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center transition-all",
                      role === r.value ? "border-primary bg-primary/10 shadow-glow" : "border-border/70 bg-card/60 hover:border-primary/40"
                    )}
                  >
                    <r.icon className={cn("h-5 w-5", role === r.value ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-sm font-semibold">{r.label}</span>
                    <span className="text-[11px] text-muted-foreground">{r.hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {!isLogin && <Field id="name" label="Full name" icon={UserIcon} placeholder="Your name" required autoComplete="name" {...bind("name")} />}
            <Field id="email" label="Email" icon={Mail} type="email" placeholder="name@example.com" required autoComplete="email" {...bind("email")} />
            {!isLogin && <Field id="phone" label="Phone (optional)" icon={Phone} type="tel" placeholder="+91 98765 43210" autoComplete="tel" {...bind("phone")} />}
            <Field
              id="password" label={isLogin ? "Password" : "Password (min. 6 characters)"} icon={Lock} type={passwordType} required minLength={isLogin ? undefined : 6}
              autoComplete={isLogin ? "current-password" : "new-password"} trailing={passwordToggle} {...bind("password")}
            />
            {!isLogin && (
              <Field id="confirmPassword" label="Confirm password" icon={Lock} type={passwordType} required minLength={6} autoComplete="new-password" {...bind("confirmPassword")} />
            )}
            {!isLogin && role === "provider" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="location" label="Business location" icon={MapPin} placeholder="Street, city" required {...bind("location")} />
                <Field id="upiId" label="UPI ID" icon={Wallet} placeholder="name@upi" required {...bind("upiId")} />
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : <Zap className="fill-current" />}
              {isLoading ? (isLogin ? "Signing in…" : "Creating account…") : isLogin ? "Sign in" : "Create account"}
            </Button>

            {role !== "admin" && (
              <>
                <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
                  <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
                </div>
                <Button type="button" variant="outline" size="lg" className="w-full" onClick={handleGoogle} disabled={isLoading}>
                  <GoogleIcon /> Continue with Google
                </Button>
              </>
            )}
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isLogin ? "New to ChargeHub? " : "Already have an account? "}
            <button type="button" onClick={() => switchMode(!isLogin)} className="font-semibold text-primary hover:underline">
              {isLogin ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Auth;
