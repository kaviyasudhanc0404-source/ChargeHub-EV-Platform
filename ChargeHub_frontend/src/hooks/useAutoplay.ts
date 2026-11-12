import { useEffect, useRef, useState, type RefObject } from "react";

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface AutoplayOptions {
  enabled?: boolean;
  restartKey?: unknown; // change it (e.g. after a manual pick) to start the wait again
}

/**
 * Calls `step` every `ms` while the element is on screen, the tab is visible and no pointer (mouse or finger) is on it.
 * Never runs with reduced motion. Shared by the home page showcases so they behave the same way.
 */
export const useAutoplay = (ref: RefObject<HTMLElement>, step: () => void, ms: number, { enabled = true, restartKey }: AutoplayOptions = {}) => {
  const [held, setHeld] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    const hold = () => setHeld(true);
    const release = () => setHeld(false);
    const onVisibility = () => setTabVisible(document.visibilityState === "visible");
    observer.observe(node);
    // Pointer (not mouse) events: a tap or swipe ends with pointerleave, so phones never stay paused
    node.addEventListener("pointerenter", hold);
    node.addEventListener("pointerleave", release);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      node.removeEventListener("pointerenter", hold);
      node.removeEventListener("pointerleave", release);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ref]);

  const active = enabled && !held && onScreen && tabVisible && !prefersReducedMotion();
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => stepRef.current(), ms);
    return () => window.clearInterval(timer);
  }, [active, ms, restartKey]);
};
