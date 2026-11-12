import { formatClock, formatDate, formatINR } from "./format";
import { escapeHtml } from "./utils";

interface ReceiptBooking {
  bookingId: string;
  stationName: string;
  bookingDate: string;
  bookingTime: string;
  duration: number;
  completedAt?: string;
  energyConsumed?: number;
  vehicleInfo?: { vehicleName?: string; vehicleType?: string };
  pricing: { ratePerHour: number; totalCost: number };
}

// Opens a printable receipt (the browser's "Save as PDF" turns it into a PDF)
export const printReceipt = (booking: ReceiptBooking, customerName: string) => {
  const rows: [string, string][] = [
    ["Booking ID", booking.bookingId],
    ["Customer", customerName],
    ["Station", booking.stationName],
    ["Vehicle", `${booking.vehicleInfo?.vehicleName || "-"} (${booking.vehicleInfo?.vehicleType || "-"})`],
    ["Slot", `${formatDate(booking.bookingDate)} at ${formatClock(booking.bookingTime)} · ${booking.duration} h`],
    ["Completed", booking.completedAt ? formatDate(booking.completedAt) : "-"],
    ...(booking.energyConsumed ? [["Energy", `${booking.energyConsumed} kWh`] as [string, string]] : []),
    ["Rate", `${formatINR(booking.pricing.ratePerHour)}/hour`],
    ["Payment", "Paid at station"],
  ];

  const receipt = window.open("", "_blank", "width=480,height=640");
  if (!receipt) return false;
  receipt.document.write(`<!DOCTYPE html><html><head><title>Receipt ${escapeHtml(booking.bookingId)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #111; padding: 24px; }
      h1 { color: #059669; margin: 0 0 4px; } p.sub { color: #6b7280; margin: 0 0 20px; }
      table { width: 100%; border-collapse: collapse; } td { padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
      td:first-child { color: #6b7280; width: 40%; } .total td { font-size: 18px; font-weight: bold; border: none; padding-top: 16px; }
    </style></head><body>
    <h1>⚡ ChargeHub</h1><p class="sub">Charging session receipt</p>
    <table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${escapeHtml(v)}</td></tr>`).join("")}
    <tr class="total"><td>Total</td><td>${formatINR(booking.pricing.totalCost)}</td></tr></table>
    <script>window.onload = () => window.print();</script></body></html>`);
  receipt.document.close();
  return true;
};
