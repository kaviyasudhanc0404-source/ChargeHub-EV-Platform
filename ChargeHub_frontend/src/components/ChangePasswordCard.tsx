import { useState, type InputHTMLAttributes } from "react";
import { ArrowRight, Check, Circle, KeyRound, Loader2, Lock, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PasswordToggle from "@/components/PasswordToggle";
import { authAPI } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { errorMessage, errorReason } from "@/lib/format";
import { cn } from "@/lib/utils";

type Step = "idle" | "current" | "new";

interface PasswordFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  shown: boolean;
  onToggle: () => void;
  error?: string;
}

const PasswordField = ({ id, label, shown, onToggle, error, ...props }: PasswordFieldProps) => (
  <div className="space-y-2">
    <Label htmlFor={id} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <Lock className="h-4 w-4 text-primary" /> {label}
    </Label>
    <div className="relative">
      <Input id={id} type={shown ? "text" : "password"} className="pr-11" aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} {...props} />
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
        <PasswordToggle shown={shown} onToggle={onToggle} />
      </div>
    </div>
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
  </div>
);

// Changing the password in two steps: confirm the current password first, then choose and re-enter the new one.
// The server checks the current password again when saving, so step 1 cannot be skipped.
const ChangePasswordCard = () => {
  const { user } = useAuthStore();
  const [step, setStep] = useState<Step>("idle");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const googleOnly = user?.hasPassword === false;

  const rules = [
    { met: next.length >= 6, text: "At least 6 characters" },
    { met: !!next && next !== current, text: "Not your current password" },
    { met: !!confirm && confirm === next, text: "Both new passwords match" },
  ];

  const reset = () => {
    setStep("idle");
    setCurrent("");
    setNext("");
    setConfirm("");
    setShown(false);
    setError("");
  };

  const run = async (request: () => Promise<unknown>, onDone: () => void) => {
    setBusy(true);
    setError("");
    try {
      await request();
      onDone();
    } catch (err) {
      // The current password no longer matches (e.g. changed on another device): back to step 1
      if (errorReason(err) === "CURRENT_PASSWORD") {
        setStep("current");
        setNext("");
        setConfirm("");
      }
      setError(errorMessage(err, "Could not check your password. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === "current") run(() => authAPI.verifyPassword(current), () => { setStep("new"); setShown(false); });
    else if (rules.every((rule) => rule.met)) {
      run(() => authAPI.changePassword(current, next), () => {
        toast.success("Password changed", { description: "Use your new password the next time you sign in." });
        reset();
      });
    }
  };

  const toggle = () => setShown((value) => !value);

  return (
    <Card className="enter">
      <form onSubmit={submit}>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Password</CardTitle>
            <CardDescription>
              {googleOnly
                ? "You sign in with Google, so there's no password to change."
                : step === "idle"
                  ? "Change the password you use to sign in."
                  : step === "current"
                    ? "Step 1 of 2: confirm it's you."
                    : "Step 2 of 2: choose your new password."}
            </CardDescription>
          </div>
          {step === "idle" && !googleOnly && (
            <Button type="button" variant="outline" size="sm" onClick={() => setStep("current")} className="shrink-0">
              <KeyRound /> Change password
            </Button>
          )}
        </CardHeader>

        {step !== "idle" && (
          <>
            <CardContent className="space-y-5">
              {/* Lets password managers save the new password for the right account */}
              <input type="email" name="username" autoComplete="username" value={user?.email || ""} readOnly hidden />

              {step === "current" ? (
                <PasswordField
                  id="current-password"
                  label="Current password"
                  value={current}
                  onChange={(e) => { setCurrent(e.target.value); setError(""); }}
                  shown={shown}
                  onToggle={toggle}
                  error={error}
                  autoComplete="current-password"
                  autoFocus
                  required
                />
              ) : (
                <>
                  <p className="flex items-center gap-2 rounded-xl bg-primary/10 px-3.5 py-2.5 text-sm text-primary">
                    <ShieldCheck className="h-4 w-4 shrink-0" /> Current password confirmed
                  </p>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <PasswordField id="new-password" label="New password" value={next} onChange={(e) => { setNext(e.target.value); setError(""); }} shown={shown} onToggle={toggle} autoComplete="new-password" autoFocus required />
                    <PasswordField id="confirm-password" label="Re-enter new password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(""); }} shown={shown} onToggle={toggle} autoComplete="new-password" required />
                  </div>
                  <ul className="grid gap-1.5 text-xs" aria-label="Password requirements">
                    {rules.map(({ met, text }) => (
                      <li key={text} className={cn("flex items-center gap-1.5", met ? "text-primary" : "text-muted-foreground")}>
                        {met ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Circle className="h-3 w-3 shrink-0" />} {text}
                      </li>
                    ))}
                  </ul>
                  {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                </>
              )}
            </CardContent>

            <CardFooter className="flex-col-reverse gap-3 border-t border-border/70 pt-6 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={reset} disabled={busy} className="w-full sm:w-auto">
                <X /> Cancel
              </Button>
              <Button
                type="submit"
                disabled={busy || (step === "current" ? !current : !rules.every((rule) => rule.met))}
                className="w-full sm:w-auto sm:min-w-[160px]"
              >
                {busy ? <Loader2 className="animate-spin" /> : step === "current" ? <ArrowRight /> : <Check />}
                {step === "current" ? "Continue" : "Update password"}
              </Button>
            </CardFooter>
          </>
        )}
      </form>
    </Card>
  );
};

export default ChangePasswordCard;
