import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Clock, Download, IndianRupee, Star, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/PageHeader";
import PageLoader from "@/components/PageLoader";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import ConfirmDialog, { type ConfirmRequest } from "@/components/ConfirmDialog";
import { bookingAPI } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { errorMessage, formatDate, formatINR, formatTime, istDay } from "@/lib/format";
import { printReceipt } from "@/lib/receipt";

interface Booking {
  _id: string;
  bookingId: string;
  stationName: string;
  bookingDate: string;
  bookingTime: string;
  duration: number;
  slotStart: string;
  slotEnd: string;
  status: "confirmed" | "completed" | "cancelled" | "no-show";
  completedAt?: string;
  energyConsumed?: number;
  vehicleInfo?: { vehicleName?: string; vehicleType?: string };
  pricing: { ratePerHour: number; totalCost: number };
  rating?: { stars?: number };
}

// The server closes a booking as "missed" when its OTP isn't verified in time, so tabs follow the status.
// Upcoming lists the soonest first; the others the most recent first.
const TABS = [
  { value: "upcoming", label: "Upcoming", statuses: ["confirmed"], soonestFirst: true, empty: "No upcoming bookings" },
  { value: "completed", label: "Completed", statuses: ["completed"], soonestFirst: false, empty: "Completed sessions will appear here" },
  { value: "cancelled", label: "Cancelled", statuses: ["cancelled", "no-show"], soonestFirst: false, empty: "No cancelled or missed bookings" },
];
const REFRESH_MS = 60 * 1000; // sessions start, end and expire while the page is open

const StarRating = ({ onRate }: { onRate: (stars: number) => void }) => {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      <span className="mr-2 text-sm text-muted-foreground">Rate this session</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onMouseEnter={() => setHover(n)} onClick={() => onRate(n)} aria-label={`${n} star`} className="transition-transform hover:scale-110">
          <Star className={`h-5 w-5 ${n <= hover ? "fill-accent text-accent" : "text-muted-foreground"}`} />
        </button>
      ))}
    </div>
  );
};

const Bookings = () => {
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [activeTab, setActiveTab] = useState("upcoming");
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  const fetchBookings = () =>
    bookingAPI
      .getUserBookings()
      .then(({ data }) => setBookings(data.data))
      .catch((error) => toast.error(errorMessage(error, "Failed to load bookings")));

  useEffect(() => {
    fetchBookings();
    const timer = window.setInterval(fetchBookings, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const byTab = useMemo(
    () =>
      Object.fromEntries(
        TABS.map((tab) => {
          const rows = (bookings || []).filter((b) => tab.statuses.includes(b.status));
          const time = (b: Booking) => new Date(b.slotStart).getTime();
          return [tab.value, rows.sort((a, b) => (tab.soonestFirst ? time(a) - time(b) : time(b) - time(a)))];
        })
      ) as Record<string, Booking[]>,
    [bookings]
  );

  const run = async (action: Promise<{ data: { message: string } }>, fallback: string) => {
    setConfirm(null);
    try {
      const { data } = await action;
      toast.success(data.message);
      fetchBookings();
    } catch (error) {
      toast.error(errorMessage(error, fallback));
    }
  };

  const cancelBooking = (booking: Booking) =>
    setConfirm({
      title: "Cancel this booking?",
      description: `${booking.stationName} on ${formatDate(booking.slotStart)} at ${formatTime(booking.slotStart)}.`,
      confirmLabel: "Cancel booking",
      destructive: true,
      onConfirm: () => run(bookingAPI.cancelBooking(booking._id, "Cancelled by user"), "Failed to cancel booking"),
    });

  if (!bookings) return <PageLoader label="Loading bookings..." />;

  // Ticket-style card: date stub on the left, details on the right
  const renderBooking = (booking: Booking, index: number) => {
    const date = istDay(booking.slotStart);
    // A confirmed booking is upcoming, in its slot, or just past it while the provider can still verify the OTP
    const now = Date.now();
    const started = booking.status === "confirmed" && new Date(booking.slotStart).getTime() <= now;
    const ended = started && new Date(booking.slotEnd).getTime() <= now;
    return (
      <Card key={booking._id} className="enter lift flex overflow-hidden" style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}>
        <div className="flex w-20 shrink-0 flex-col items-center justify-center border-r border-dashed border-border bg-primary/10 text-primary sm:w-24">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">{date.weekday}</p>
          <p className="font-display text-3xl font-bold leading-none">{date.day}</p>
          <p className="mt-1 text-xs font-semibold uppercase">{date.month}</p>
          <p className="text-[11px] text-muted-foreground">{date.year}</p>
        </div>
        <div className="min-w-0 flex-1 space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-semibold">{booking.stationName}</h3>
              <p className="font-mono text-xs text-muted-foreground">#{booking.bookingId}</p>
            </div>
            <StatusBadge status={booking.status} label={booking.status === "confirmed" ? (ended ? "Awaiting OTP" : started ? "In progress" : "Upcoming") : undefined} />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4 text-primary" />{formatTime(booking.slotStart)} – {formatTime(booking.slotEnd)} · {booking.duration}h</span>
            <span className="inline-flex items-center gap-1.5"><IndianRupee className="h-4 w-4 text-primary" />{formatINR(booking.pricing.totalCost)}</span>
            <span className="inline-flex items-center gap-1.5"><Zap className="h-4 w-4 text-primary" />{booking.vehicleInfo?.vehicleName} ({booking.vehicleInfo?.vehicleType})</span>
          </div>
          {booking.status === "confirmed" && (
            <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              {ended
                ? `Your slot ended at ${formatTime(booking.slotEnd)}. Share your OTP with the provider now, or this booking will be marked as missed.`
                : started
                  ? `Session in progress until ${formatTime(booking.slotEnd)}. The provider verifies your OTP, then you pay at the station.`
                  : "Pay at the station after the provider verifies your session OTP."}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {booking.status === "completed" &&
              (booking.rating?.stars ? (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  You rated {booking.rating.stars} <Star className="h-4 w-4 fill-accent text-accent" />
                </p>
              ) : (
                <StarRating onRate={(stars) => run(bookingAPI.rateBooking(booking._id, stars), "Failed to submit rating")} />
              ))}
            <div className="ml-auto flex gap-2">
              {booking.status === "completed" && (
                <Button size="sm" variant="outline" onClick={() => !printReceipt(booking, user?.name || "") && toast.error("Allow pop-ups to download the receipt")}>
                  <Download /> Receipt
                </Button>
              )}
              {booking.status === "confirmed" && !started && (
                <Button size="sm" variant="outline" onClick={() => cancelBooking(booking)} className="border-destructive/50 text-destructive hover:bg-destructive/10">
                  <X /> Cancel
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <>
      <PageHeader
        title="My bookings"
        description="Your charging sessions — upcoming, completed and cancelled."
        actions={
          <Button asChild>
            <Link to="/user/map"><Calendar /> New booking</Link>
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-5 grid w-full grid-cols-3 sm:inline-grid sm:w-auto">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:px-5 sm:text-sm">
              {tab.label} ({byTab[tab.value].length})
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((tab) => {
          const rows = byTab[tab.value];
          return (
            <TabsContent key={tab.value} value={tab.value} className="mt-0">
              {rows.length === 0 ? (
                <Card>
                  <EmptyState icon={Calendar} title={tab.empty} description={tab.value === "upcoming" ? "Find a station on the map and book a slot." : undefined} />
                </Card>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">{rows.map(renderBooking)}</div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  );
};

export default Bookings;
