import { useId } from "react";
import { cn } from "@/lib/utils";

const BUBBLE = "M20 3C10.6 3 3 10.2 3 19.1c0 3.2 1 6.2 2.7 8.7L4 35.5l7.7-2.5A17.6 17.6 0 0 0 20 35.2c9.4 0 17-7.2 17-16.1S29.4 3 20 3Z";

// "Ask Me" mark: a speech bubble carrying a charging bolt, in the assistant's aurora colours
const AiOrb = ({ className }: { className?: string }) => {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 40 40" className={cn("h-8 w-8 shrink-0", className)} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}f`} x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "hsl(var(--ai))" }} />
          <stop offset="1" style={{ stopColor: "hsl(var(--ai-2))" }} />
        </linearGradient>
        <radialGradient id={`${id}s`} cx="13" cy="9" r="17" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={BUBBLE} fill={`url(#${id}f)`} />
      <path d={BUBBLE} fill={`url(#${id}s)`} />
      <path d="M22.6 9.2 13.4 21.3h5.9l-1.9 9.5 9.2-12.1h-5.9l1.9-9.5Z" fill="#fff" />
    </svg>
  );
};

export default AiOrb;
