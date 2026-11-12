import { useEffect, useRef } from "react";
import { BatteryCharging, CalendarClock, ChevronDown, HelpCircle, Lock, PanelRightClose, Plug, SquarePen, Zap, type LucideIcon } from "lucide-react";
import BookingDialog from "@/components/BookingDialog";
import { useChatContext } from "@/contexts/ChatContext";
import { useAuthStore } from "@/store/authStore";
import { useBookStation } from "@/hooks/useBookStation";
import { useSpeechOutput } from "@/hooks/useVoice";
import { toPlainText } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import AiOrb from "./AiOrb";
import ChatMessage from "./ChatMessage";
import ChatComposer, { type ComposerHandle } from "./ChatComposer";

interface Suggestion {
  icon: LucideIcon;
  text: string;
  live?: boolean; // answered from ChargeHub's live data (needs a sign-in)
}

const FAST_CHARGER: Suggestion = { icon: Zap, text: "Find a fast charger near me that's open now", live: true };
const BATTERY_TIPS: Suggestion = { icon: BatteryCharging, text: "How do I make my EV battery last longer?" };
const SUGGESTIONS: Record<"driver" | "general", Suggestion[]> = {
  driver: [
    FAST_CHARGER,
    { icon: CalendarClock, text: "Show my upcoming bookings", live: true },
    { icon: Plug, text: "Cheapest charger near me, and the cost to charge 20% to 80%", live: true },
    BATTERY_TIPS,
  ],
  general: [
    FAST_CHARGER,
    { icon: Plug, text: "Type 2 or CCS: which does my car use?" },
    BATTERY_TIPS,
    { icon: HelpCircle, text: "How does booking a charger on ChargeHub work?" },
  ],
};

const headerButton = "grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

const Welcome = ({ onPick }: { onPick: (text: string) => void }) => {
  const { user } = useAuthStore();
  const firstName = user?.name?.split(" ")[0];
  return (
    <div className="enter flex min-h-full flex-col justify-center py-4">
      <div className="text-center">
        <div className="relative mx-auto mb-4 grid h-20 w-20 place-items-center">
          <span aria-hidden className="absolute inset-0 rounded-full bg-aurora opacity-25 blur-2xl" />
          <AiOrb className="relative h-14 w-14 animate-float" />
        </div>
        <h2 className="font-display text-xl font-semibold">
          Hi{firstName ? `, ${firstName}` : ""}! I'm <span className="text-aurora">Ask Me</span>
        </h2>
        <p className="mx-auto mt-1.5 max-w-[19rem] text-sm text-muted-foreground">
          ChargeHub's AI for EV drivers. Type, attach a photo, or tap the mic and talk in English, தமிழ் or हिन्दी.
        </p>
      </div>

      <p className="mb-2 mt-6 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Try asking</p>
      <div className="grid gap-2">
        {SUGGESTIONS[user?.role === "user" ? "driver" : "general"].map(({ icon: Icon, text, live }) => (
          <button
            key={text}
            type="button"
            onClick={() => onPick(text)}
            className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-background/40 px-3.5 py-3 text-left text-sm transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-ai/40 hover:bg-ai/5"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-ai/10 text-ai transition-colors group-hover:bg-aurora group-hover:text-white">
              <Icon className="h-4 w-4" />
            </span>
            <span className="flex-1">{text}</span>
            {live && <span className="rounded-full bg-ai-2/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ai-2">Live</span>}
          </button>
        ))}
      </div>
      {!user && (
        <p className="mt-3 flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Live station search and bookings need a free sign-in.
        </p>
      )}
    </div>
  );
};

const Thinking = () => (
  <div className="enter flex items-center gap-2.5" role="status">
    <AiOrb className="h-7 w-7 animate-pulse" />
    <span className="flex h-9 items-center gap-[3px] rounded-full border border-border/60 bg-muted/40 px-4" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="h-3.5 w-[3px] rounded-full bg-aurora animate-wave" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
    <span className="text-xs text-muted-foreground">Thinking…</span>
  </div>
);

// The assistant window: full screen on phones, a floating panel at the bottom right on larger screens
const ChatPanel = () => {
  const { messages, isOpen, isLoading, close, dock, sendMessage, clearChat } = useChatContext();
  const { bookingStation, book, closeBooking } = useBookStation();
  const { speakingId, speak, stop } = useSpeechOutput();
  const composer = useRef<ComposerHandle>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // Keep the newest message in view (the welcome screen starts at the top)
  useEffect(() => {
    if (messages.length) scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, isLoading]);

  // Opening focuses the message box (not on touch screens, where it would pop up the keyboard); closing stops voice
  useEffect(() => {
    if (isOpen && matchMedia("(hover: hover)").matches) composer.current?.focus();
    if (!isOpen) {
      stop();
      composer.current?.stopListening();
    }
  }, [isOpen, stop]);

  // Escape closes the panel, unless a dialog or menu on top of it handled the key first
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && !bookingStation && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, bookingStation, close]);

  // A question asked by voice is answered out loud too
  const send = async (text: string, { image, voice }: { image?: string; voice?: boolean }) => {
    stop();
    const answer = await sendMessage(text, image);
    if (voice && answer && !answer.failed) speak(answer.id, toPlainText(answer.content));
  };

  const newChat = () => {
    stop();
    clearChat();
    composer.current?.focus();
  };

  return (
    <>
      {isOpen && <div aria-hidden onClick={close} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] animate-in fade-in sm:hidden" />}
      <section
        role="dialog"
        aria-label="Ask Me assistant"
        className={cn(
          // Phones: a card with a small margin on every side (clear of the notch and home bar); larger: bottom-right panel
          "fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] top-[max(0.5rem,env(safe-area-inset-top))] z-50 flex flex-col overflow-hidden rounded-[1.5rem] border border-ai/25 bg-card",
          "sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(44rem,calc(100dvh-3rem))] sm:w-[25rem] sm:rounded-[1.75rem]",
          "shadow-[0_40px_100px_-30px_rgb(0_0_0/0.7),0_0_60px_-30px_hsl(var(--ai)/0.6)]",
          "origin-bottom-right animate-in fade-in zoom-in-95 slide-in-from-bottom-3 duration-300",
          !isOpen && "hidden"
        )}
      >
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(70%_100%_at_15%_0%,hsl(var(--ai)/0.22),transparent_70%),radial-gradient(60%_90%_at_100%_0%,hsl(var(--ai-2)/0.16),transparent_70%)]" />

        <header className="relative flex items-center gap-3 border-b border-border/60 px-4 py-3">
          <AiOrb className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold leading-tight">Ask Me</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("h-1.5 w-1.5 rounded-full", isLoading ? "animate-pulse bg-ai" : "bg-ai-2")} />
              {isLoading ? "Thinking…" : "ChargeHub AI · online"}
            </p>
          </div>
          {messages.length > 0 && (
            <button type="button" onClick={newChat} className={headerButton} aria-label="New chat" title="New chat">
              <SquarePen className="h-[18px] w-[18px]" />
            </button>
          )}
          <button type="button" onClick={() => dock(true)} className={headerButton} aria-label="Minimise to the side" title="Minimise to the side">
            <PanelRightClose className="h-[18px] w-[18px]" />
          </button>
          <button type="button" onClick={close} className={headerButton} aria-label="Close assistant" title="Close">
            <ChevronDown className="h-5 w-5" />
          </button>
        </header>

        <div ref={scroller} className="scroll-thin relative flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5">
          {messages.length === 0 ? (
            <Welcome onPick={(text) => send(text, {})} />
          ) : (
            messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                speaking={speakingId === message.id}
                onSpeak={() => (speakingId === message.id ? stop() : speak(message.id, toPlainText(message.content)))}
                onBook={book}
              />
            ))
          )}
          {isLoading && <Thinking />}
        </div>

        <ChatComposer ref={composer} busy={isLoading} onSend={send} />
        <BookingDialog station={bookingStation} onClose={closeBooking} />
      </section>
    </>
  );
};

export default ChatPanel;
