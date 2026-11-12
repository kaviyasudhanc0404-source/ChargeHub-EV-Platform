import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ArrowUp, ImagePlus, Mic, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { canListen, useSpeechInput, VOICE_LANGUAGES, type VoiceLanguage } from "@/hooks/useVoice";
import { readStored, writeStored } from "@/lib/storage";
import { cn } from "@/lib/utils";

export interface ComposerHandle {
  focus: () => void;
  stopListening: () => void;
}

interface ChatComposerProps {
  busy: boolean;
  onSend: (text: string, options: { image?: string; voice?: boolean }) => void;
}

const LANGUAGE_KEY = "askme-voice-language";
const PHOTO_MAX_PX = 1280; // longest side sent to the assistant (plenty to read a connector or a label)
const PHOTO_QUALITY = 0.85;

// A photo as a JPEG data URL no larger than PHOTO_MAX_PX on its longest side (phone photos are often 4–12 MB)
const shrinkPhoto = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, PHOTO_MAX_PX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", PHOTO_QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable image"));
    };
    img.src = url;
  });
const MAX_HEIGHT_PX = 128;
const toolButton = "grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40";

// Message box: type (Enter sends, Shift+Enter new line), attach a photo, or tap the mic and speak
const ChatComposer = forwardRef<ComposerHandle, ChatComposerProps>(({ busy, onSend }, ref) => {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [language, setLanguage] = useState<VoiceLanguage>(() => readStored(LANGUAGE_KEY, "en-IN"));
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const voice = useSpeechInput(language, (spoken) => onSend(spoken, { voice: true }));

  useImperativeHandle(ref, () => ({ focus: () => textarea.current?.focus(), stopListening: voice.stop }), [voice.stop]);
  useEffect(() => writeStored(LANGUAGE_KEY, language), [language]);

  // Grows with the text up to a few lines
  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [text, voice.transcript]);

  const attach = (file?: File) => {
    if (!file) return;
    shrinkPhoto(file).then(setImage, () => toast.error("That file isn't an image we can read. Try a JPG or PNG photo."));
  };

  const submit = () => {
    if (busy || (!text.trim() && !image)) return;
    onSend(text.trim(), { image: image || undefined });
    setText("");
    setImage(null);
  };

  const languageInfo = VOICE_LANGUAGES.find((l) => l.code === language)!;

  return (
    <div className="border-t border-border/60 bg-card/80 px-3 pb-3 pt-3 backdrop-blur-xl">
      <div
        className={cn(
          "rounded-[1.4rem] border bg-background/70 p-1.5 transition-[border-color,box-shadow]",
          voice.listening ? "border-ai/60 shadow-aurora" : "border-border/70 focus-within:border-ai/50 focus-within:shadow-[0_0_0_4px_hsl(var(--ai)/0.12)]"
        )}
      >
        {image && (
          <div className="relative m-1.5 inline-block">
            <img src={image} alt="To send" className="h-16 w-16 rounded-xl border border-border object-cover" />
            <button type="button" onClick={() => setImage(null)} aria-label="Remove image" className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-foreground text-background">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-1">
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => { attach(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" onClick={() => fileInput.current?.click()} disabled={busy || voice.listening} className={toolButton} aria-label="Attach a photo" title="Attach a photo">
            <ImagePlus className="h-[18px] w-[18px]" />
          </button>

          {voice.listening ? (
            <div className="flex min-h-9 flex-1 items-center gap-2.5 px-1 py-1.5" aria-live="polite">
              <span className="flex h-5 items-center gap-[3px]" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="h-full w-[3px] origin-center rounded-full bg-aurora animate-wave" style={{ animationDelay: `${i * 0.12}s` }} />
                ))}
              </span>
              <span className={cn("text-sm", voice.transcript ? "text-foreground" : "text-muted-foreground")}>
                {voice.transcript || `Listening in ${languageInfo.label}…`}
              </span>
            </div>
          ) : (
            <textarea
              ref={textarea}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Ask me anything…"
              aria-label="Message Ask Me"
              className="scroll-thin min-h-9 flex-1 resize-none bg-transparent px-1 py-[0.45rem] text-sm leading-5 outline-none placeholder:text-muted-foreground"
            />
          )}

          {canListen && (
            <div className="flex items-center rounded-full bg-muted/60">
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" disabled={voice.listening} className="h-9 pl-3 pr-1 text-[11px] font-semibold tracking-wide text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40" aria-label={`Voice language: ${languageInfo.label}`} title="Voice language">
                    {languageInfo.short}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" side="top" className="z-[60] w-40 p-1.5">
                  <p className="px-2 pb-1 pt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Speak in</p>
                  {VOICE_LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setLanguage(l.code)}
                      className={cn("flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted", l.code === language && "text-ai")}
                    >
                      {l.label} <span className="text-[11px] text-muted-foreground">{l.short}</span>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
              <button
                type="button"
                onClick={voice.listening ? voice.stop : voice.start}
                disabled={busy}
                className={cn(toolButton, voice.listening && "bg-destructive text-destructive-foreground hover:bg-destructive hover:text-destructive-foreground")}
                aria-label={voice.listening ? "Stop listening" : "Speak your question"}
                title={voice.listening ? "Stop" : "Speak"}
              >
                {voice.listening ? <Square className="h-3.5 w-3.5 fill-current" /> : <Mic className="h-[18px] w-[18px]" />}
              </button>
            </div>
          )}

          {!voice.listening && (
            <button
              type="button"
              onClick={submit}
              disabled={busy || (!text.trim() && !image)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-aurora text-white shadow-aurora transition-[opacity,transform] hover:scale-105 active:scale-95 disabled:scale-100 disabled:opacity-35 disabled:shadow-none"
              aria-label="Send"
            >
              <ArrowUp className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-[10.5px] text-muted-foreground">Ask Me can make mistakes. Check important details.</p>
    </div>
  );
});
ChatComposer.displayName = "ChatComposer";

export default ChatComposer;
