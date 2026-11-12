import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { chatAPI, type ChatReply, type LatLng } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { LOCATE_ERRORS, useCurrentLocation } from "@/hooks/useCurrentLocation";
import { errorMessage } from "@/lib/format";
import { readStored, writeStored } from "@/lib/storage";

export interface ChatMessage extends Omit<ChatReply, "reply"> {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string;
  timestamp: number;
  failed?: boolean;
}

interface ChatContextType {
  messages: ChatMessage[];
  isOpen: boolean;
  docked: boolean; // minimised to a tab on the right edge
  isLoading: boolean;
  locatingFor: string | null; // message waiting for the device location
  open: () => void;
  close: () => void;
  dock: (docked: boolean) => void;
  sendMessage: (content: string, image?: string) => Promise<ChatMessage | undefined>;
  retry: (id: string) => Promise<ChatMessage>;
  shareLocation: (id: string) => void;
  clearChat: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChatContext must be used within ChatProvider");
  return context;
};

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const CHAT_KEY = "askme-chat"; // this tab's conversation (images are not kept)
const DOCK_KEY = "askme-docked";

let sequence = 0;
const newMessage = (role: ChatMessage["role"], content: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id: `${Date.now()}-${++sequence}`,
  role,
  content,
  timestamp: Date.now(),
  ...extra,
});

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>(() => readStored(CHAT_KEY, [], "session"));
  const [isOpen, setIsOpen] = useState(false);
  const [docked, setDocked] = useState(() => readStored(DOCK_KEY, false));
  const [isLoading, setIsLoading] = useState(false);
  const [locatingFor, setLocatingFor] = useState<string | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const gps = useCurrentLocation();

  useEffect(() => writeStored(CHAT_KEY, messages.map(({ image, ...message }) => message), "session"), [messages]);
  useEffect(() => writeStored(DOCK_KEY, docked), [docked]);

  // Signed-in users who already allowed location get "near me" answers from where they are, without being asked
  useEffect(() => {
    if (!isOpen || !user || gps.fix || gps.status !== "idle" || !navigator.permissions) return;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((permission) => permission.state === "granted" && gps.locate())
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user]);

  // Sends the conversation and appends the answer (failed answers are shown but never sent back)
  const ask = async (history: ChatMessage[], location?: LatLng | null) => {
    setIsLoading(true);
    let answer: ChatMessage;
    try {
      const turns = history.filter((m) => !m.failed).map(({ role, content, image, context }) => ({ role, content, image, context }));
      const { data } = await chatAPI.send(turns, location ?? gps.fix);
      const { reply, ...extras } = data.data;
      answer = newMessage("assistant", reply, extras);
    } catch (error) {
      answer = newMessage("assistant", errorMessage(error, "Sorry, I couldn't reach the assistant. Please try again."), { failed: true });
    }
    setMessages((current) => [...current, answer]);
    setIsLoading(false);
    return answer;
  };

  const sendMessage = async (content: string, image?: string) => {
    // base64 data URLs are ~4/3 of the file size
    if (image && image.length * 0.75 > MAX_IMAGE_BYTES) {
      toast.error("That image is too large. Please use one under 4 MB.");
      return undefined;
    }
    const history = [...messagesRef.current, newMessage("user", content.trim(), { image })];
    setMessages(history);
    return ask(history);
  };

  // Asks the question before message `id` again (after signing in, sharing location or a failure); the new answer
  // replaces that message
  const retry = (id: string, location?: LatLng) => {
    const history = messagesRef.current.slice(0, messagesRef.current.findIndex((m) => m.id === id));
    setMessages(history);
    return ask(history, location);
  };

  const shareLocation = (id: string) => {
    setLocatingFor(id);
    gps.locate();
  };

  // The first device reading is enough for "near me"
  useEffect(() => {
    if (!locatingFor) return;
    if (gps.fix) {
      gps.cancel();
      setLocatingFor(null);
      retry(locatingFor, gps.fix);
    } else if (gps.status !== "locating" && gps.status !== "idle" && gps.status !== "done") {
      setLocatingFor(null);
      toast.error(LOCATE_ERRORS[gps.status]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locatingFor, gps.fix, gps.status]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        isOpen,
        docked,
        isLoading,
        locatingFor,
        open: () => {
          setIsOpen(true);
          setDocked(false);
        },
        close: () => setIsOpen(false),
        dock: (value) => {
          setDocked(value);
          if (value) setIsOpen(false);
        },
        sendMessage,
        retry,
        shareLocation,
        clearChat: () => setMessages([]),
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
