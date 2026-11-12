import { useEffect, useState } from "react";
import { CheckCircle, Loader2, MailCheck, RotateCw, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { bookingAPI, type OtpState } from "@/services/api";
import { errorMessage, formatDuration, formatINR, formatTime } from "@/lib/format";

export interface VerifiableBooking {
  _id: string;
  userName: string;
  userId?: { name: string };
  vehicleInfo?: { vehicleName: string };
  pricing: { totalCost: number };
  otp?: OtpState | null; // code the customer currently holds (from the server)
}

interface VerifySessionDialogProps {
  booking: VerifiableBooking | null;
  onClose: () => void;
  onVerified: () => void;
  reload: () => Promise<VerifiableBooking[]>; // the latest bookings, to pick up a code sent while the app stopped waiting
}

const statusOf = (error: unknown) => (error as { response?: { status?: number } })?.response?.status;

// Provider's check-in: email the customer a code, then enter it. Which step shows follows the server: while a code is
// valid the dialog always opens on entering it (with Resend), however often it is closed and reopened.
const VerifySessionDialog = ({ booking, onClose, onVerified, reload }: VerifySessionDialogProps) => {
  const [code, setCode] = useState<OtpState | null>(null);
  const [otp, setOtp] = useState("");
  const [energy, setEnergy] = useState("");
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!booking) return;
    setCode(booking.otp ?? null);
    setOtp("");
    setEnergy("");
    const timer = window.setInterval(() => setNow(Date.now()), 1000); // countdowns
    return () => window.clearInterval(timer);
  }, [booking]);

  const live = code && new Date(code.expiresAt).getTime() > now ? code : null;
  const expired = !!code && !live;
  const resendIn = live ? new Date(live.resendAt).getTime() - now : 0;

  const send = async () => {
    if (!booking) return;
    setBusy("send");
    try {
      const { data } = await bookingAPI.sendOTP(booking._id);
      setCode(data.data);
      setOtp("");
      toast.success(data.message, { description: data.data.otp ? `Development OTP: ${data.data.otp}` : undefined });
    } catch (error) {
      // A slow mail server can outlast the app's wait while the code still goes out: use the code the server saved
      const saved = (await reload().catch(() => [])).find((b) => b._id === booking._id)?.otp;
      if (saved) setCode(saved);
      if (saved && statusOf(error) !== 429) toast.info("The code is on its way to the customer's email. Enter it when they have it.");
      else toast.error(errorMessage(error, "Failed to send OTP"));
    } finally {
      setBusy(null);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;
    setBusy("verify");
    try {
      const { data } = await bookingAPI.verifyOTP(booking._id, { otp, energyConsumed: Number(energy) || undefined });
      toast.success(data.message);
      onVerified();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to verify OTP"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={!!booking} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify charging session</DialogTitle>
          <DialogDescription>
            {booking?.userId?.name || booking?.userName} · {booking?.vehicleInfo?.vehicleName} · {booking && formatINR(booking.pricing.totalCost)} to collect
          </DialogDescription>
        </DialogHeader>

        {!live ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {expired
                ? "The last code has expired. Send a new one to the customer."
                : "A 6-digit code will be emailed to the customer. It can be sent from 30 minutes before the slot and stays valid until 30 minutes after the slot ends."}
            </p>
            <Button onClick={send} disabled={!!busy} className="w-full">
              {busy === "send" ? <Loader2 className="animate-spin" /> : <Send />}
              {busy === "send" ? "Sending…" : "Send OTP to customer"}
            </Button>
          </div>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <p className="flex items-start gap-2 rounded-xl bg-primary/10 px-3.5 py-2.5 text-sm text-primary">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Code sent to the customer's email · valid until {formatTime(live.expiresAt)} ({formatDuration(Math.ceil((new Date(live.expiresAt).getTime() - now) / 60000))} left)
              </span>
            </p>
            <div className="space-y-2">
              <Label htmlFor="otp">Customer's 6-digit OTP</Label>
              <Input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="energy">Energy delivered (kWh, optional)</Label>
              <Input id="energy" type="number" step="0.1" min="0" placeholder="e.g. 25.5" value={energy} onChange={(e) => setEnergy(e.target.value)} />
            </div>
            <Button type="submit" disabled={!!busy || otp.length !== 6} className="w-full">
              {busy === "verify" ? <Loader2 className="animate-spin" /> : <CheckCircle />}
              Verify & complete
            </Button>
            <Button type="button" variant="ghost" onClick={send} disabled={!!busy || resendIn > 0} className="w-full">
              {busy === "send" ? <Loader2 className="animate-spin" /> : <RotateCw />}
              {resendIn > 0 ? `Resend code in ${Math.ceil(resendIn / 1000)} s` : "Resend code"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VerifySessionDialog;
