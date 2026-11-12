import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Escapes text for safe insertion into HTML strings (map popups, printable receipts)
export const escapeHtml = (text: unknown) =>
  String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Copies text to the clipboard; falls back to a hidden textarea where the Clipboard API is unavailable
// (e.g. a phone opening the dev site over plain http on the local network)
export const copyText = async (text: string) => {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(area);
  area.select();
  const copied = document.execCommand("copy");
  area.remove();
  if (!copied) throw new Error("Copy failed");
};

// Square icon button used in the navigation bars (theme, chat, notifications, report)
export const iconButton =
  "relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border/70 bg-card/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground";
