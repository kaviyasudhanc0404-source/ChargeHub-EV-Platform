import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Copy, Loader2, LocateFixed, LogIn, RotateCcw, Square, Volume2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useChatContext, type ChatMessage as Message } from "@/contexts/ChatContext";
import { useAuthStore } from "@/store/authStore";
import { canSpeak } from "@/hooks/useVoice";
import type { Station } from "@/lib/stations";
import { cn, copyText } from "@/lib/utils";
import AiOrb from "./AiOrb";
import RichText from "./RichText";
import StationStrip from "./StationStrip";

interface ChatMessageProps {
  message: Message;
  speaking: boolean;
  onSpeak: () => void;
  onBook: (station: Station) => void;
}

const time = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// A follow-up the answer needs from the user (sign in, share location, try again)
const Prompt = ({ icon: Icon, text, children }: { icon: LucideIcon; text: string; children: ReactNode }) => (
  <div className="flex flex-col gap-2.5 rounded-2xl border border-ai/25 bg-ai/5 p-3 sm:flex-row sm:items-center">
    <p className="flex flex-1 items-start gap-2 text-xs text-muted-foreground">
      <Icon className="mt-px h-4 w-4 shrink-0 text-ai" /> {text}
    </p>
    <div className="flex gap-2">{children}</div>
  </div>
);

const ActionButton = ({ onClick, children, busy }: { onClick: () => void; children: ReactNode; busy?: boolean }) => (
  <Button size="sm" onClick={onClick} disabled={busy} className="h-8 rounded-full border-0 bg-aurora text-white hover:opacity-90">
    {busy && <Loader2 className="animate-spin" />}
    {children}
  </Button>
);

const ChatMessage = ({ message, speaking, onSpeak, onBook }: ChatMessageProps) => {
  const { id, role, content, image, timestamp, stations, fromLabel, needsLogin, needsLocation, failed } = message;
  const { retry, shareLocation, locatingFor, isLoading } = useChatContext();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (role === "user") {
    return (
      <div className="enter flex flex-col items-end gap-1.5 pl-10">
        {image && <img src={image} alt="Attached" className="max-h-48 rounded-2xl border border-border object-cover" />}
        {content && <p className="whitespace-pre-wrap break-words rounded-[1.25rem] rounded-br-md bg-aurora px-4 py-2.5 text-sm text-white shadow-aurora">{content}</p>}
        <span className="text-[11px] text-muted-foreground">{time(timestamp)}</span>
      </div>
    );
  }

  const copy = () => copyText(content).then(() => toast.success("Copied"), () => toast.error("Could not copy"));

  return (
    <div className="enter flex gap-2.5">
      <AiOrb className="mt-0.5 h-7 w-7" />
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className={cn("rounded-[1.25rem] rounded-tl-md border px-4 py-3", failed ? "border-destructive/30 bg-destructive/5" : "border-border/60 bg-muted/40")}>
          <RichText text={content} />
        </div>

        {!!stations?.length && <StationStrip stations={stations} fromLabel={fromLabel} onBook={onBook} />}

        {needsLogin && (
          <Prompt icon={LogIn} text={user ? "You're signed in now." : "Live answers use your account, so it's private to you."}>
            {user ? (
              <ActionButton onClick={() => retry(id)} busy={isLoading}><RotateCcw /> Ask again</ActionButton>
            ) : (
              <ActionButton onClick={() => navigate("/auth", { state: { from: pathname } })}><LogIn /> Sign in</ActionButton>
            )}
          </Prompt>
        )}
        {needsLocation && (
          <Prompt icon={LocateFixed} text='Share your location, or name a place, e.g. "chargers near Gandhipuram".'>
            <ActionButton onClick={() => shareLocation(id)} busy={locatingFor === id}><LocateFixed /> Use my location</ActionButton>
          </Prompt>
        )}
        {failed && (
          <Button size="sm" variant="outline" onClick={() => retry(id)} disabled={isLoading} className="h-8 rounded-full">
            <RotateCcw /> Try again
          </Button>
        )}

        <div className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
          <span className="mr-1.5">{time(timestamp)}</span>
          {canSpeak && !failed && (
            <button type="button" onClick={onSpeak} className="grid h-7 w-7 place-items-center rounded-lg transition-colors hover:bg-muted hover:text-foreground" aria-label={speaking ? "Stop reading" : "Read aloud"} title={speaking ? "Stop" : "Read aloud"}>
              {speaking ? <Square className="h-3.5 w-3.5 fill-current text-ai" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
          )}
          <button type="button" onClick={copy} className="grid h-7 w-7 place-items-center rounded-lg transition-colors hover:bg-muted hover:text-foreground" aria-label="Copy answer" title="Copy">
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
