import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Voice input (browser speech recognition: Chrome, Edge, Safari) and spoken replies (speech synthesis)
export const VOICE_LANGUAGES = [
  { code: "en-IN", short: "EN", label: "English" },
  { code: "ta-IN", short: "TA", label: "தமிழ்" },
  { code: "hi-IN", short: "HI", label: "हिन्दी" },
] as const;
export type VoiceLanguage = (typeof VOICE_LANGUAGES)[number]["code"];

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: (event: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void;
  onerror: (event: { error: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionConstructor = new () => Recognition;

const speechWindow = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
const RecognitionImpl = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
export const canListen = !!RecognitionImpl;
export const canSpeak = "speechSynthesis" in window;

const LISTEN_ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it from the icon left of the address bar.",
  "service-not-allowed": "Microphone access is blocked. Allow it from the icon left of the address bar.",
  "audio-capture": "No microphone was found.",
  network: "Voice input needs an internet connection.",
  "no-speech": "I didn't hear anything. Tap the mic and speak.",
  "language-not-supported": "This browser can't recognise that language yet. Try English.",
};

/**
 * Speech → text. `transcript` updates live while the user speaks; `onFinal` gets the full sentence once they pause.
 */
export const useSpeechInput = (lang: VoiceLanguage, onFinal: (text: string) => void) => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const stop = useCallback(() => recognition.current?.stop(), []);

  const start = useCallback(() => {
    if (!RecognitionImpl) return;
    recognition.current?.abort();
    const r = new RecognitionImpl();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = false; // ends after a pause: one question at a time
    r.maxAlternatives = 1;
    let finalText = "";
    r.onresult = ({ resultIndex, results }) => {
      let interim = "";
      for (let i = resultIndex; i < results.length; i++) {
        if (results[i].isFinal) finalText += results[i][0].transcript;
        else interim += results[i][0].transcript;
      }
      setTranscript(`${finalText}${interim}`.trim());
    };
    r.onerror = ({ error }) => {
      if (error !== "aborted") toast.error(LISTEN_ERRORS[error] || "Voice input stopped. Please try again.");
    };
    r.onend = () => {
      setListening(false);
      setTranscript("");
      if (recognition.current === r) recognition.current = null;
      if (finalText.trim()) onFinalRef.current(finalText.trim());
    };
    recognition.current = r;
    setTranscript("");
    setListening(true);
    r.start();
  }, [lang]);

  useEffect(() => () => recognition.current?.abort(), []);

  return { listening, transcript, start, stop };
};

// Sentences are queued one by one: some browsers cut off a single long utterance after ~15 s
const sentences = (text: string) => text.match(/[^.!?।]+[.!?।]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [];

// Reply language from its script, so a Tamil or Hindi answer is read by a matching voice
const languageOf = (text: string): VoiceLanguage => (/[஀-௿]/.test(text) ? "ta-IN" : /[ऀ-ॿ]/.test(text) ? "hi-IN" : "en-IN");

const voiceFor = (lang: string) => {
  const voices = speechSynthesis.getVoices();
  const prefix = lang.slice(0, 2);
  return voices.find((v) => v.lang === lang) || voices.find((v) => v.lang.startsWith(prefix));
};

/** Text → speech; `speakingId` is the message being read, so its button can show "stop" */
export const useSpeechOutput = () => {
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (canSpeak) speechSynthesis.cancel();
    setSpeakingId(null);
  }, []);

  const speak = useCallback((id: string, text: string) => {
    if (!canSpeak) return;
    speechSynthesis.cancel();
    const parts = sentences(text);
    if (!parts.length) return;
    const lang = languageOf(text);
    const voice = voiceFor(lang);
    parts.forEach((part, i) => {
      const utterance = new SpeechSynthesisUtterance(part);
      utterance.lang = voice?.lang || lang;
      if (voice) utterance.voice = voice;
      utterance.rate = 1.02;
      if (i === parts.length - 1) utterance.onend = () => setSpeakingId((current) => (current === id ? null : current));
      speechSynthesis.speak(utterance);
    });
    setSpeakingId(id);
  }, []);

  useEffect(() => stop, [stop]);

  return { speakingId, speak, stop };
};
