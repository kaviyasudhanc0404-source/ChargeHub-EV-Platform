import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight, Bot, CalendarCheck, IndianRupee, MapPin, PlugZap, Route, Search, ShieldCheck, Sparkles, TrendingUp, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Reveal from "@/components/Reveal";
import FeaturedStations, { type FeaturedStation } from "@/components/home/FeaturedStations";
import { stationAPI } from "@/services/api";
import { useAutoplay } from "@/hooks/useAutoplay";
import { useCountUp } from "@/hooks/useCountUp";
import { cn } from "@/lib/utils";

type Stats = { stations: number; providers: number; sessions: number; featured: FeaturedStation[] };

const STEPS = [
  { icon: Search, title: "Search your place", text: "Any village, town, landmark or plus code — or tap My location." },
  { icon: CalendarCheck, title: "Book a slot", text: "See road distance, drive time and price, then reserve your time." },
  { icon: PlugZap, title: "Charge & pay there", text: "Share the OTP with the provider, charge up and pay at the station." },
];

const FEATURES = [
  { icon: Route, title: "Real road distances", text: "Driving distance and time to every charger — not a straight line on a map.", className: "md:col-span-4" },
  { icon: MapPin, title: "Every village", text: "40,000+ Tamil Nadu places and plus codes.", className: "md:col-span-2" },
  { icon: ShieldCheck, title: "OTP-verified sessions", text: "Each charge is confirmed with a one-time code.", className: "md:col-span-2" },
  { icon: Bot, title: "Ask Me assistant", text: "An AI helper for charging questions, tips and connector types.", className: "md:col-span-2" },
  { icon: IndianRupee, title: "Pay at the station", text: "No wallets or card details — pay the provider directly.", className: "md:col-span-2" },
];

const PROVIDER_POINTS = ["List chargers with an exact map pin", "Accept bookings and verify sessions by OTP", "Track collections, ratings and busy hours"];

const BARS = [38, 52, 44, 70, 58, 86, 74];

const Stat = ({ value, label }: { value?: number; label: string }) => {
  const shown = useCountUp(value);
  return (
    <div>
      <p className="font-display text-2xl font-bold text-foreground sm:text-3xl">{value == null ? "—" : shown.toLocaleString("en-IN")}</p>
      <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
    </div>
  );
};

const FeatureCard = ({ feature, index, className }: { feature: (typeof FEATURES)[number]; index: number; className?: string }) => (
  <Reveal delay={index * 80} className={cn("lift group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-6", feature.className, className)}>
    <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl transition-opacity group-hover:opacity-100 md:opacity-60" />
    <span className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
      <feature.icon className="h-5 w-5" />
    </span>
    <h3 className="text-lg font-semibold">{feature.title}</h3>
    <p className="mt-1.5 text-sm text-muted-foreground">{feature.text}</p>
    {index === 0 && (
      <svg viewBox="0 0 400 70" className="mt-6 h-16 w-full" aria-hidden>
        <path d="M10 55 C 80 55, 90 15, 170 20 S 260 60, 320 35 S 380 15, 390 15" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" className="flow-line" />
        <circle cx="10" cy="55" r="6" fill="hsl(var(--electric))" />
        <circle cx="390" cy="15" r="6" fill="hsl(var(--primary))" />
      </svg>
    )}
  </Reveal>
);

const [leadFeature, ...moreFeatures] = FEATURES;
const STRIP_MS = 4000;

// Next card in the phone strip, back to the first after the last (does nothing when it is laid out as a grid)
const slideNext = (strip: HTMLElement | null) => {
  const card = strip?.firstElementChild as HTMLElement | null;
  if (!strip || !card || strip.scrollWidth <= strip.clientWidth) return;
  const atEnd = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 8;
  strip.scrollTo({ left: atEnd ? 0 : strip.scrollLeft + card.offsetWidth, behavior: "smooth" });
};

const Index = () => {
  const { hash } = useLocation();
  const [stats, setStats] = useState<Stats | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  useAutoplay(stripRef, () => slideNext(stripRef.current), STRIP_MS);

  useEffect(() => {
    stationAPI.getPublicStats().then(({ data }) => setStats(data.data)).catch(() => setStats(null));
  }, []);

  // "/#providers" from the navbar scrolls to that section
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />
        <svg className="pointer-events-none absolute inset-x-0 top-24 h-64 w-full opacity-60" viewBox="0 0 1200 240" preserveAspectRatio="none" aria-hidden>
          <path d="M0 180 C 240 180, 300 60, 520 80 S 860 200, 1200 60" fill="none" stroke="hsl(var(--primary) / 0.5)" strokeWidth="1.5" className="flow-line" />
          <path d="M0 220 C 300 220, 420 120, 640 140 S 980 230, 1200 120" fill="none" stroke="hsl(var(--electric) / 0.35)" strokeWidth="1.5" className="flow-line [animation-duration:9s]" />
        </svg>

        <div className="container relative grid items-center gap-14 py-14 md:py-20 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-7 text-center lg:text-left">
            <span className="enter inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary">
              <span className="live-dot" /> Live across Tamil Nadu · works all over India
            </span>
            <h1 className="enter text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl xl:text-7xl" style={{ animationDelay: "80ms" }}>
              Find a charger.
              <br />
              Book a slot.
              <br />
              <span className="text-gradient">Drive electric.</span>
            </h1>
            <p className="enter mx-auto max-w-xl text-base text-muted-foreground sm:text-lg lg:mx-0" style={{ animationDelay: "160ms" }}>
              ChargeHub shows the real road distance to every EV charger near you, lets you reserve a time, and you simply pay at the station.
            </p>
            <div className="enter flex flex-col justify-center gap-3 sm:flex-row lg:justify-start" style={{ animationDelay: "240ms" }}>
              <Button asChild size="lg">
                <Link to="/stations">
                  <Zap className="fill-current" /> Find stations near me
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth?mode=register&type=provider">
                  List your charger <ArrowRight />
                </Link>
              </Button>
            </div>
            <div className="enter mx-auto grid max-w-md grid-cols-3 divide-x divide-border rounded-2xl border border-border/70 bg-card/60 py-4 text-center lg:mx-0" style={{ animationDelay: "320ms" }}>
              <Stat value={stats?.stations} label="Stations" />
              <Stat value={stats?.providers} label="Providers" />
              <Stat value={stats?.sessions} label="Sessions" />
            </div>
          </div>

          <div className="enter" style={{ animationDelay: "200ms" }}>
            <FeaturedStations stations={stats?.featured} />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container py-20">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">How it works</p>
          <h2 className="text-3xl font-bold sm:text-4xl">From empty battery to the road in three steps</h2>
        </Reveal>
        <div className="relative grid gap-10 md:grid-cols-3 md:gap-6">
          <div className="absolute left-7 top-7 h-[calc(100%-3.5rem)] w-px bg-gradient-to-b from-primary via-electric to-transparent md:left-[16.6%] md:right-[16.6%] md:h-px md:w-auto md:bg-gradient-to-r" />
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 120} className="relative flex gap-5 md:flex-col md:items-center md:text-center">
              <span className="relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-primary/40 bg-card shadow-glow">
                <step.icon className="h-6 w-6 text-primary" />
                <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-primary font-display text-xs font-bold text-primary-foreground">{i + 1}</span>
              </span>
              <div>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">{step.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features bento */}
      <section className="container pb-20">
        <Reveal className="mb-10 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Why ChargeHub</p>
          <h2 className="text-3xl font-bold sm:text-4xl">Built for real roads, real villages and real drivers</h2>
        </Reveal>
        <div className="grid gap-4 md:grid-cols-6">
          <FeatureCard feature={leadFeature} index={0} />
          {/* Phones: a sideways strip that slides by itself and can be swiped; tablet and up: part of the bento grid */}
          <div ref={stripRef} className="scroll-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto overflow-y-hidden px-4 py-1 sm:-mx-6 sm:scroll-px-6 sm:px-6 md:contents">
            {moreFeatures.map((feature, i) => (
              <FeatureCard key={feature.title} feature={feature} index={i + 1} className="w-[78%] shrink-0 snap-start sm:w-[45%] md:w-auto" />
            ))}
          </div>
        </div>
      </section>

      {/* Providers */}
      <section id="providers" className="scroll-mt-24 border-y border-border/70 bg-card/40">
        <div className="container grid items-center gap-12 py-20 lg:grid-cols-2">
          <Reveal className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">For charger owners</p>
            <h2 className="text-3xl font-bold sm:text-4xl">Own a charger? Turn it into steady income.</h2>
            <p className="text-muted-foreground">Homes, shops, hotels and bus stands — list your charging point and drivers nearby can find and book it.</p>
            <ul className="space-y-3">
              {PROVIDER_POINTS.map((point) => (
                <li key={point} className="flex items-center gap-3 text-sm">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-accent/15 text-accent"><Zap className="h-3.5 w-3.5 fill-current" /></span>
                  {point}
                </li>
              ))}
            </ul>
            <Button asChild size="lg" className="bg-accent text-accent-foreground shadow-[0_8px_24px_-10px_hsl(var(--accent)/0.8)]">
              <Link to="/auth?mode=register&type=provider">
                Become a provider <ArrowRight />
              </Link>
            </Button>
          </Reveal>

          <Reveal delay={150} className="rounded-3xl border border-border/70 bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Collected this week</p>
                <p className="font-display text-4xl font-bold">₹12,480</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">
                <TrendingUp className="h-3.5 w-3.5" /> +18%
              </span>
            </div>
            <div className="mt-8 flex h-40 items-end gap-3">
              {BARS.map((height, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <div className="w-full rounded-t-lg bg-gradient-to-t from-accent/30 to-accent transition-all duration-700" style={{ height: `${height}%` }} />
                  <span className="text-[11px] text-muted-foreground">{"MTWTFSS"[i]}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Call to action */}
      <section className="container py-20">
        <Reveal className="relative overflow-hidden rounded-3xl bg-energy px-6 py-14 text-center text-primary-foreground sm:px-12">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-30" />
          <Sparkles className="relative mx-auto mb-4 h-8 w-8" />
          <h2 className="relative text-3xl font-bold sm:text-4xl">Ready to plug in?</h2>
          <p className="relative mx-auto mt-3 max-w-lg opacity-80">See the chargers around you right now — no account needed to look.</p>
          <Button asChild size="lg" className="relative mt-8 bg-background text-foreground shadow-xl hover:bg-background">
            <Link to="/stations">
              Open the station map <ArrowRight />
            </Link>
          </Button>
        </Reveal>
      </section>
    </>
  );
};

export default Index;
