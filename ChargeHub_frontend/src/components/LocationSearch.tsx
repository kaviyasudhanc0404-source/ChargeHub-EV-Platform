import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { geoAPI, type LatLng, type PlaceSuggestion } from "@/services/api";
import { errorMessage } from "@/lib/format";

interface LocationSearchProps {
  onSelect: (place: PlaceSuggestion) => void;
  near?: LatLng | null; // rank results close to this point first
  placeholder?: string;
  className?: string;
  defaultValue?: string; // text shown at first (e.g. the saved place), not searched until edited
  onTextChange?: (text: string) => void; // every change of the box's text, typed or picked
}

const MIN_CHARS = 3;
const DEBOUNCE_MS = 350;

// Search box with place suggestions from anywhere in India (towns, villages, landmarks, addresses, plus codes)
const LocationSearch = ({ onSelect, near, placeholder = "Search a place, village, address or plus code", className = "", defaultValue = "", onTextChange }: LocationSearchProps) => {
  const [text, setText] = useState(defaultValue);
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultsFor, setResultsFor] = useState(""); // query the current suggestions belong to
  const skipNext = useRef(!!defaultValue);
  const enterPending = useRef(false); // Enter pressed before suggestions for the typed text arrived
  const nearRef = useRef(near);
  nearRef.current = near;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onTextChangeRef = useRef(onTextChange);
  onTextChangeRef.current = onTextChange;

  const changeText = useCallback((value: string) => {
    setText(value);
    onTextChangeRef.current?.(value);
  }, []);

  const choose = useCallback((place: PlaceSuggestion) => {
    skipNext.current = true; // don't search again for the label we just filled in
    changeText(place.label);
    setOpen(false);
    onSelectRef.current(place);
  }, [changeText]);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const query = text.trim();
    if (query.length < MIN_CHARS) {
      setResults([]);
      setError("");
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await geoAPI.search(query, nearRef.current, controller.signal);
        setResults(data.data);
        setResultsFor(query);
        setError(data.data.length ? "" : "No matching places. Try a nearby town or landmark.");
        setActive(0);
        if (enterPending.current && data.data[0]) {
          enterPending.current = false;
          choose(data.data[0]);
          return;
        }
        setOpen(true);
      } catch (err) {
        if (!controller.signal.aborted) {
          setResults([]);
          setError(errorMessage(err, "Location search failed"));
          setOpen(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      setLoading(false); // an aborted request must not leave the spinner running
    };
  }, [text, choose]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") setActive((i) => Math.min(i + 1, results.length - 1));
    else if (e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0));
    else if (e.key === "Escape") setOpen(false);
    else if (e.key === "Enter") {
      // Suggestions may still be for an earlier, shorter query: wait for the current ones
      if (resultsFor === text.trim() && results[active]) choose(results[active]);
      else enterPending.current = text.trim().length >= MIN_CHARS;
    } else return;
    e.preventDefault();
  };

  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={text}
        onChange={(e) => {
          enterPending.current = false;
          changeText(e.target.value);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => (results.length || error) && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="pl-10 pr-10"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {/* Centred by the wrapper, so the spin (a CSS transform) can't undo a translate and make the icon jump */}
      {loading && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </span>
      )}
      {open && (results.length > 0 || error) && (
        <ul role="listbox" className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-2xl animate-in fade-in slide-in-from-top-1">
          {error && !results.length ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">{error}</li>
          ) : (
            results.map((place, i) => (
              <li
                key={`${place.lat},${place.lng},${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(place)}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${i === active ? "bg-primary/10" : ""}`}
              >
                <MapPin className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span className="text-foreground">{place.label}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default LocationSearch;
