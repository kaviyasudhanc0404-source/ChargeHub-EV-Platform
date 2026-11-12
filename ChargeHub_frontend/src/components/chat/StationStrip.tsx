import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import StationCard from "@/components/StationCard";
import { toCard, type Station } from "@/lib/stations";
import { cn } from "@/lib/utils";

interface StationStripProps {
  stations: Station[];
  fromLabel?: string;
  onBook: (station: Station) => void;
}

const GAP_PX = 12;
const navButton =
  "grid h-7 w-7 place-items-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:border-ai/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-30";

// Station cards in an answer: all the same size side by side; swipe on touch screens, arrows with a mouse
const StationStrip = ({ stations, fromLabel, onBook }: StationStripProps) => {
  const strip = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const several = stations.length > 1;

  const updateEdges = () => {
    const el = strip.current;
    if (el) setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
  };
  useEffect(updateEdges, [stations.length]);

  // One card per click
  const move = (direction: 1 | -1) => {
    const el = strip.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (el && card) el.scrollBy({ left: direction * (card.offsetWidth + GAP_PX), behavior: "smooth" });
  };

  return (
    <div>
      <div ref={strip} onScroll={updateEdges} className="scroll-none flex snap-x snap-mandatory scroll-px-1 gap-3 overflow-x-auto px-1 pb-1 pt-1">
        {stations.map((station) => (
          <div key={station._id} className={cn("grid shrink-0 snap-start", several ? "w-[min(17rem,85%)]" : "w-full")}>
            <StationCard compact station={toCard(station, fromLabel || "you")} onBook={() => onBook(station)} />
          </div>
        ))}
      </div>
      {several && (
        <div className="mt-1.5 flex items-center justify-between gap-2 px-0.5">
          <span className="text-[11px] text-muted-foreground">{stations.length} stations · nearest first</span>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => move(-1)} disabled={edge.start} className={navButton} aria-label="Previous station">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => move(1)} disabled={edge.end} className={navButton} aria-label="Next station">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StationStrip;
