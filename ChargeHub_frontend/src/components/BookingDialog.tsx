import { useEffect, useRef, useState } from "react";
import { CalendarCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SlotPicker from "@/components/SlotPicker";
import { bookingAPI, type AvailabilityDay } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { errorMessage, formatClock, formatINR } from "@/lib/format";

type VehicleType = "car" | "bike";

export interface BookableStation {
  _id: string;
  name: string;
  vehicleType: "car" | "bike" | "both";
  pricing: { ratePerHour: number };
}

const MIN_HOURS = 1;
const MAX_HOURS = 8;
const AVAILABILITY_DEBOUNCE_MS = 300; // while the duration is being typed

const hoursOf = (value: string) => Math.min(Math.max(Math.round(Number(value)) || MIN_HOURS, MIN_HOURS), MAX_HOURS);
const firstFreeDay = (days: AvailabilityDay[]) => days.find((d) => d.slots.some((s) => s.status === "open"))?.date || "";

// Slot booking form for one station (open while `station` is set). Times come from the server's availability, so
// booked times are marked before the driver picks them.
const BookingDialog = ({ station, onClose }: { station: BookableStation | null; onClose: () => void }) => {
  const { user } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [days, setDays] = useState<AvailabilityDay[] | null>(null);
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState({
    vehicleName: user?.vehicleInfo?.vehicleName || user?.vehicleInfo?.vehicleModel || "",
    vehicleType: (user?.vehicleInfo?.vehicleType === "bike" ? "bike" : "car") as VehicleType,
    bookingDate: "",
    bookingTime: "",
    duration: "2",
  });
  const hours = hoursOf(form.duration);
  const formRef = useRef(form);
  formRef.current = form;

  // A new station starts with a fresh date and time; a car-only or bike-only charger fixes the vehicle type
  useEffect(() => {
    if (!station) return;
    setForm((f) => ({
      ...f,
      bookingDate: "",
      bookingTime: "",
      ...(station.vehicleType !== "both" && { vehicleType: station.vehicleType as VehicleType }),
    }));
  }, [station]);

  // Free and booked times for this station and duration (latest request wins)
  useEffect(() => {
    if (!station) return;
    let current = true;
    setDays(null);
    const timer = window.setTimeout(() => {
      bookingAPI
        .getAvailability(station._id, hours)
        .then(({ data }) => {
          if (!current) return;
          // Keep the chosen day and time while they are still free; otherwise move to the first free day
          const { bookingDate, bookingTime } = formRef.current;
          const day = data.data.find((d) => d.date === bookingDate);
          const timeStillFree = day?.slots.some((s) => s.time === bookingTime && s.status === "open");
          if (bookingTime && !timeStillFree) toast.info(`${formatClock(bookingTime)} isn't free for a ${hours} h session any more. Please choose another time.`);
          setDays(data.data);
          setForm((f) => ({
            ...f,
            bookingDate: day?.slots.some((s) => s.status === "open") ? bookingDate : firstFreeDay(data.data),
            bookingTime: timeStillFree ? bookingTime : "",
          }));
        })
        .catch((error) => current && (setDays([]), toast.error(errorMessage(error, "Could not load free times"))));
    }, AVAILABILITY_DEBOUNCE_MS);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [station, hours, reload]);

  const total = station ? station.pricing.ratePerHour * hours : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!station || !form.bookingDate || !form.bookingTime) return;
    setSaving(true);
    try {
      await bookingAPI.createBooking({
        stationId: station._id,
        vehicleInfo: { vehicleName: form.vehicleName.trim(), vehicleType: form.vehicleType },
        bookingDate: form.bookingDate,
        bookingTime: form.bookingTime,
        duration: hours,
      });
      toast.success(`Booking confirmed at ${station.name}`, { description: `Total ${formatINR(total)} — pay at the station.` });
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to create booking"));
      setReload((n) => n + 1); // someone may have just taken this time: show the latest availability
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!station} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Book a charging slot</DialogTitle>
          <DialogDescription>{station?.name} · pay at the station after your session</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vehicleName">Vehicle name / model</Label>
            <Input id="vehicleName" placeholder="e.g. Tata Nexon EV, Ather 450X" value={form.vehicleName} onChange={(e) => setForm({ ...form, vehicleName: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Vehicle type</Label>
            <Select value={form.vehicleType} onValueChange={(vehicleType: VehicleType) => setForm({ ...form, vehicleType })} disabled={station?.vehicleType !== "both"}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="car">Car</SelectItem>
                <SelectItem value="bike">Bike</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (hours)</Label>
            <Input id="duration" type="number" min={MIN_HOURS} max={MAX_HOURS} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} required />
          </div>
          <SlotPicker
            days={days}
            date={form.bookingDate}
            time={form.bookingTime}
            duration={hours}
            onDate={(bookingDate) => setForm((f) => ({ ...f, bookingDate, bookingTime: "" }))}
            onTime={(bookingTime) => setForm((f) => ({ ...f, bookingTime }))}
          />
          {days?.length === 0 && <p className="text-sm text-muted-foreground">No free times in the next 30 days. Try a shorter session.</p>}
          {station && (
            <div className="flex items-center justify-between rounded-xl border border-primary/25 bg-primary/10 p-4 text-sm">
              <span className="text-muted-foreground">
                {formatINR(station.pricing.ratePerHour)}/hour × {hours}h
                <span className="block text-xs">pay at the station</span>
              </span>
              <span className="font-display text-2xl font-bold text-primary">{formatINR(total)}</span>
            </div>
          )}
          <Button type="submit" size="lg" disabled={saving || !form.bookingDate || !form.bookingTime} className="w-full">
            {saving ? <Loader2 className="animate-spin" /> : <CalendarCheck />}
            {form.bookingTime ? "Confirm booking" : "Choose a date and time"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BookingDialog;
