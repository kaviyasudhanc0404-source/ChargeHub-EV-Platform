import { lazy, Suspense, useEffect, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { useChatContext } from "@/contexts/ChatContext";
import { readStored, writeStored } from "@/lib/storage";
import { cn } from "@/lib/utils";
import AiOrb from "./AiOrb";

const loadPanel = () => import("./ChatPanel");
const ChatPanel = lazy(loadPanel);

const GREETED_KEY = "askme-greeted";
const GREETING_DELAY_MS = 3000;

// The "Ask Me" assistant on every page: a floating button at the bottom right that can be tucked into a tab on the
// right edge (like a browser extension). The panel's code loads on first open (or hover), so pages stay fast.
const ChatWidget = () => {
  const { isOpen, docked, open, dock } = useChatContext();
  const [panelLoaded, setPanelLoaded] = useState(isOpen);
  useEffect(() => {
    if (isOpen) setPanelLoaded(true);
  }, [isOpen]);

  // A one-time hello beside the button on larger screens, so first-time visitors notice the assistant
  const [greeting, setGreeting] = useState(false);
  useEffect(() => {
    if (readStored(GREETED_KEY, false) || !matchMedia("(min-width: 768px)").matches) return;
    const timer = window.setTimeout(() => setGreeting(true), GREETING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);
  const endGreeting = () => {
    setGreeting(false);
    writeStored(GREETED_KEY, true);
  };
  useEffect(() => {
    if (isOpen || docked) endGreeting();
  }, [isOpen, docked]);

  return (
    <>
      {panelLoaded && (
        <Suspense fallback={null}>
          <ChatPanel />
        </Suspense>
      )}

      {!isOpen && docked && (
        <button
          type="button"
          onClick={open}
          onPointerEnter={loadPanel}
          aria-label="Open Ask Me assistant"
          title="Ask Me"
          className="chat-float enter fixed right-0 z-50 grid h-14 w-10 place-items-center rounded-l-2xl border border-r-0 border-ai/30 bg-card/90 pl-0.5 shadow-aurora backdrop-blur-xl transition-[width] duration-300 hover:w-14"
        >
          <AiOrb className="h-7 w-7" />
        </button>
      )}

      {!isOpen && !docked && (
        <div className="chat-float enter group fixed right-4 z-50 md:right-6">
          {greeting && (
            <div className="enter absolute bottom-full right-0 mb-3 w-72 rounded-2xl border border-ai/30 bg-card/95 p-4 pr-9 text-sm shadow-aurora backdrop-blur-xl">
              <button type="button" onClick={endGreeting} aria-label="Dismiss" className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={open} onPointerEnter={loadPanel} className="text-left">
                <span className="block font-semibold">Hi! I'm Ask Me 👋</span>
                <span className="mt-1 block text-muted-foreground">I can find chargers near you, estimate charging time and cost, and answer EV questions.</span>
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={open}
            onPointerEnter={loadPanel}
            onFocus={loadPanel}
            aria-label="Open Ask Me assistant"
            className="relative flex items-center rounded-full shadow-aurora transition-transform duration-300 hover:scale-[1.03] active:scale-95"
          >
            {/* Phones: a round button with a turning colour ring */}
            <span className="relative grid h-[3.75rem] w-[3.75rem] place-items-center md:hidden">
              <span aria-hidden className="aurora-ring absolute inset-0 rounded-full" />
              <span aria-hidden className="absolute inset-[2.5px] rounded-full bg-card" />
              <AiOrb className="relative h-8 w-8" />
            </span>
            {/* Larger screens: a labelled pill, so the assistant is easy to spot */}
            <span className="hidden rounded-full bg-aurora p-[2px] md:block">
              <span className="flex items-center gap-3 rounded-full bg-card py-2 pl-2 pr-5">
                <span className="relative grid h-10 w-10 place-items-center">
                  <span aria-hidden className="absolute inset-0 rounded-full bg-ai/30 animate-ping-slow" />
                  <AiOrb className="relative h-10 w-10 transition-transform duration-300 group-hover:-rotate-6" />
                </span>
                <span className="text-left leading-tight">
                  <span className="block font-display text-sm font-semibold">Ask Me</span>
                  <span className="block text-xs text-muted-foreground">AI help for chargers &amp; bookings</span>
                </span>
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => dock(true)}
            aria-label="Move Ask Me to the side of the screen"
            title="Move to the side"
            className={cn(
              "absolute -left-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-md transition hover:text-foreground",
              "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
            )}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
};

export default ChatWidget;
