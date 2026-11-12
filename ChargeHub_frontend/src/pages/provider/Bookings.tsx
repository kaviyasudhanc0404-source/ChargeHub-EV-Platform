import { useEffect, useMemo, useState } from "react";
import { CheckCircle, KeyRound, Trash2, Car } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import VerifySessionDialog, { type VerifiableBooking } from "@/components/VerifySessionDialog";
import DataTable, { type Column } from "@/components/DataTable";
import ConfirmDialog, { type ConfirmRequest } from "@/components/ConfirmDialog";
import { bookingAPI } from "@/services/api";
import { errorMessage, formatClock, formatDate, formatINR } from "@/lib/format";

interface Booking extends VerifiableBooking {
  bookingId: string;
  userId?: { name: string; phone?: string };
  stationName: string;
  vehicleInfo?: { vehicleName: string; vehicleType: string };
  bookingDate: string;
  bookingTime: string;
  duration: number;
  status: "confirmed" | "completed" | "cancelled" | "no-show";
  pricing: { totalCost: number };
}

const Bookings = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "history">("active");
  const [verifying, setVerifying] = useState<Booking | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  const fetchBookings = (): Promise<Booking[]> =>
    bookingAPI
      .getProviderBookings()
      .then(({ data }) => {
        setBookings(data.data);
        return data.data;
      })
      .catch((error) => {
        toast.error(errorMessage(error, "Failed to load bookings"));
        return [];
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchBookings();
  }, []);

  const deleteBooking = (booking: Booking) =>
    setConfirm({
      title: "Delete this booking from history?",
      description: `${booking.bookingId} will be removed permanently.`,
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: async () => {
        setConfirm(null);
        try {
          const { data } = await bookingAPI.deleteBooking(booking._id);
          toast.success(data.message);
          fetchBookings();
        } catch (error) {
          toast.error(errorMessage(error, "Failed to delete booking"));
        }
      },
    });

  const rows = useMemo(
    () => bookings.filter((b) => (tab === "active" ? b.status === "confirmed" : b.status !== "confirmed")),
    [bookings, tab]
  );
  const activeCount = bookings.filter((b) => b.status === "confirmed").length;

  const columns: Column<Booking>[] = [
    { header: "Booking", cell: (b) => <span className="font-mono text-xs">{b.bookingId}</span>, className: "hidden lg:table-cell" },
    {
      header: "Customer",
      cell: (b) => (
        <div>
          <p className="font-semibold">{b.userId?.name || b.userName}</p>
          {b.userId?.phone && <p className="text-xs text-muted-foreground">{b.userId.phone}</p>}
        </div>
      ),
    },
    {
      header: "Vehicle",
      cell: (b) => (
        <span className="flex items-center gap-2">
          <Car className="h-4 w-4 text-primary" /> {b.vehicleInfo?.vehicleName} ({b.vehicleInfo?.vehicleType})
        </span>
      ),
      className: "hidden sm:table-cell",
    },
    {
      header: "Slot",
      cell: (b) => (
        <div>
          <p>{formatDate(b.bookingDate)}</p>
          <p className="text-xs text-muted-foreground">{formatClock(b.bookingTime)} · {b.duration}h · {b.stationName}</p>
        </div>
      ),
      className: "hidden md:table-cell",
    },
    { header: "Amount", cell: (b) => <span className="font-bold text-primary">{formatINR(b.pricing.totalCost)}</span> },
    { header: "Status", cell: (b) => <StatusBadge status={b.status} /> },
    {
      header: "Actions",
      cell: (b) =>
        b.status === "confirmed" ? (
          <Button size="sm" onClick={() => setVerifying(b)}>
            {b.otp ? <KeyRound /> : <CheckCircle />} {b.otp ? "Enter OTP" : "Verify"}
          </Button>
        ) : (
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" title="Delete" onClick={() => deleteBooking(b)}>
            <Trash2 />
          </Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader title="Bookings" description="When the customer arrives, verify the session with the OTP sent to their email, then collect payment." />

      <Card className="enter">
        <CardContent className="space-y-5 p-4 md:p-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="grid w-full grid-cols-2 sm:inline-grid sm:w-auto">
              <TabsTrigger value="active">Upcoming ({activeCount})</TabsTrigger>
              <TabsTrigger value="history">History ({bookings.length - activeCount})</TabsTrigger>
            </TabsList>
          </Tabs>
          <DataTable columns={columns} rows={rows} rowKey={(b) => b._id} loading={loading} empty={tab === "active" ? "No upcoming bookings" : "No booking history"} />
        </CardContent>
      </Card>

      <VerifySessionDialog booking={verifying} onClose={() => setVerifying(null)} onVerified={() => (setVerifying(null), fetchBookings())} reload={fetchBookings} />

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  );
};

export default Bookings;
