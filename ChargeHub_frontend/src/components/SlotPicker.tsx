import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Loader2, Moon, Sun, Sunrise, Sunset } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AvailabilityDay, SlotStatus } from "@/services/api";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";

interface SlotPickerProps {
  days: AvailabilityDay[] | null; // null while loading
  date: string; // YYYY-MM-DD
  time: string; // HH:mm, "" until chosen
  duration: number;
  onDate: (date: string) => void;
  onTime: (time: string) => void;
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const PERIODS = [
  { label: "Morning", hint: "6 AM – 12 PM", icon: Sunrise, from: 6, to: 12 },
  { label: "Afternoon", hint: "12 PM – 5 PM", icon: Sun, from: 12, to: 17 },
  { label: "Evening", hint: "5 PM – 12 AM", icon: Sunset, from: 17, to: 24 },
  { label: "Night", hint: "12 AM – 6 AM", icon: Moon, from: 0, to: 6 },
];
const SLOT_STYLE: Record<SlotStatus, string> = {
  open: "border-border/70 hover:border-primary/60 hover:bg-primary/10",
  booked: "cursor-not-allowed border-destructive/30 bg-destructive/10 text-destructive/80 line-through",
  clash: "cursor-not-allowed border-dashed border-border/70 text-muted-foreground/60",
};
const SLOT_TEXT: Record<SlotStatus, string> = { open: "available", booked: "already booked", clash: "not enough time before the next booking" };

const field =
  "flex h-11 w-full items-center gap-2.5 rounded-xl border border-input bg-background/60 px-3.5 text-left text-sm transition-colors hover:border-primary/40 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-primary";

// Dates are YYYY-MM-DD strings read in UTC, so the browser's own timezone can never shift a day
const utc = (date: string) => new Date(`${date}T00:00:00Z`);
const dateText = (date: string, options: Intl.DateTimeFormatOptions) => utc(date).toLocaleDateString("en-IN", { timeZone: "UTC", ...options });
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const monthKey = (date: string) => date.slice(0, 7);

// "3:00 PM – 8:00 PM" for a session starting at `time`
const rangeOf = (time: string, hours: number) => {
  const [h, m] = time.split(":").map(Number);
  const end = h * 60 + m + hours * 60;
  const endClock = `${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  return `${formatClock(time)} – ${formatClock(endClock)}${end >= 1440 ? " (next day)" : ""}`;
};

// open: every time free · partial: some booked · full: nothing left · none: no bookable times (closed or past)
const dayState = (day?: AvailabilityDay) => {
  if (!day?.slots.length) return "none";
  const open = day.slots.filter((s) => s.status === "open").length;
  return !open ? "full" : open < day.slots.length ? "partial" : "open";
};

const Legend = ({ items }: { items: [string, string][] }) => (
  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
    {items.map(([swatch, text]) => (
      <span key={text} className="inline-flex items-center gap-1.5">
        <span className={cn("inline-block", swatch)} /> {text}
      </span>
    ))}
  </div>
);

// Date and start-time fields for a booking, each opening a themed picker that marks booked times
const SlotPicker = ({ days, date, time, duration, onDate, onTime }: SlotPickerProps) => {
  const [open, setOpen] = useState<"date" | "time" | null>(null);
  const byDate = useMemo(() => new Map((days || []).map((d) => [d.date, d])), [days]);
  const first = days?.[0]?.date;
  const last = days?.[days.length - 1]?.date;
  // The month on show: the one browsed to, else the chosen date's, else the first bookable one ("" while loading)
  const [browsed, setBrowsed] = useState("");
  useEffect(() => setBrowsed(""), [date]);
  const month = browsed || monthKey(date || first || "");
  const monthStart = utc(`${month || "1970-01"}-01`);
  const cells = useMemo(() => {
    if (!month) return [];
    const blanks = (monthStart.getUTCDay() + 6) % 7; // weeks start on Monday
    const count = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
    return [...Array(blanks).fill(null), ...Array.from({ length: count }, (_, i) => ymd(new Date(monthStart.getTime() + i * 86400000)))];
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps
  const shiftMonth = (by: number) => setBrowsed(monthKey(ymd(new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + by, 1)))));

  const slots = byDate.get(date)?.slots || [];
  const pickDate = (value: string) => {
    onDate(value);
    setOpen("time"); // straight on to choosing the time
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <span className="text-sm font-medium">Date</span>
        {/* modal: the booking dialog blocks wheel/touchpad scrolling outside itself, and these pickers are drawn outside
            it; a modal popover becomes the active layer, so its own list scrolls */}
        <Popover modal open={open === "date"} onOpenChange={(o) => setOpen(o ? "date" : null)}>
          <PopoverTrigger asChild>
            <button type="button" className={field} disabled={!days} aria-label={`Date: ${date ? dateText(date, { day: "numeric", month: "long" }) : "not chosen"}`}>
              {days ? <CalendarDays className="h-4 w-4 shrink-0 text-primary" /> : <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
              <span className={cn("truncate", !date && "text-muted-foreground")}>{date ? dateText(date, { weekday: "short", day: "numeric", month: "short" }) : "Choose a date"}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[19.5rem] p-3">
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={() => shiftMonth(-1)} disabled={!first || month <= monthKey(first)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30" aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="font-display text-sm font-semibold">{month && dateText(`${month}-01`, { month: "long", year: "numeric" })}</p>
              <button type="button" onClick={() => shiftMonth(1)} disabled={!last || month >= monthKey(last)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30" aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((d) => (
                <span key={d} className="py-1 text-[11px] font-medium text-muted-foreground">{d}</span>
              ))}
              {cells.map((value, i) => {
                if (!value) return <span key={`blank-${i}`} />;
                const state = dayState(byDate.get(value));
                const selectable = state === "open" || state === "partial";
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={!selectable}
                    onClick={() => pickDate(value)}
                    aria-label={`${dateText(value, { day: "numeric", month: "long" })}${state === "partial" ? ", some times booked" : state === "full" ? ", fully booked" : ""}`}
                    aria-pressed={value === date}
                    className={cn(
                      "relative grid h-9 place-items-center rounded-lg text-sm transition-colors",
                      value === date ? "bg-primary font-semibold text-primary-foreground" : selectable ? "hover:bg-primary/10" : "text-muted-foreground/40",
                      state === "full" && "text-destructive/70 line-through",
                      value === first && value !== date && "ring-1 ring-inset ring-primary/50"
                    )}
                  >
                    {Number(value.slice(8))}
                    {state === "partial" && <span className={cn("absolute bottom-1 h-1 w-1 rounded-full", value === date ? "bg-primary-foreground" : "bg-accent")} />}
                  </button>
                );
              })}
            </div>
            <Legend items={[["h-1.5 w-1.5 rounded-full bg-accent", "Some times booked"], ["h-px w-3 bg-destructive", "Fully booked"], ["h-3 w-3 rounded ring-1 ring-primary/50", "Today"]]} />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">Start time</span>
        <Popover modal open={open === "time"} onOpenChange={(o) => setOpen(o ? "time" : null)}>
          <PopoverTrigger asChild>
            <button type="button" className={field} disabled={!days || !date} aria-label={`Start time: ${time ? formatClock(time) : "not chosen"}`}>
              <Clock className="h-4 w-4 shrink-0 text-primary" />
              <span className={cn("truncate", !time && "text-muted-foreground")}>{time ? rangeOf(time, duration) : "Choose a time"}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-3">
            <p className="mb-2.5 text-xs text-muted-foreground">
              {date && dateText(date, { weekday: "long", day: "numeric", month: "short" })} · pick when your {duration} h session starts
            </p>
            <div className="scroll-thin max-h-72 space-y-3 overflow-y-auto pr-1">
              {slots.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No times left on this day.</p>}
              {PERIODS.map(({ label, hint, icon: Icon, from, to }) => {
                const rows = slots.filter((s) => Number(s.time.slice(0, 2)) >= from && Number(s.time.slice(0, 2)) < to);
                if (!rows.length) return null;
                return (
                  <div key={label}>
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Icon className="h-3.5 w-3.5 text-primary" /> {label}
                      <span className="font-normal text-muted-foreground">· {hint}</span>
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {rows.map((slot) => (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={slot.status !== "open"}
                          onClick={() => {
                            onTime(slot.time);
                            setOpen(null);
                          }}
                          title={slot.status === "open" ? rangeOf(slot.time, duration) : `${formatClock(slot.time)}: ${SLOT_TEXT[slot.status]}`}
                          aria-label={`${formatClock(slot.time)}, ${SLOT_TEXT[slot.status]}`}
                          aria-pressed={slot.time === time}
                          className={cn(
                            "rounded-lg border py-2 text-sm font-medium tabular-nums transition-colors",
                            slot.time === time ? "border-primary bg-primary text-primary-foreground" : SLOT_STYLE[slot.status]
                          )}
                        >
                          {formatClock(slot.time)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <Legend items={[["h-2.5 w-2.5 rounded-sm border border-border", "Available"], ["h-2.5 w-2.5 rounded-sm bg-destructive/30", "Booked"], ["h-2.5 w-2.5 rounded-sm border border-dashed border-border", `Too short for ${duration} h`]]} />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

export default SlotPicker;
