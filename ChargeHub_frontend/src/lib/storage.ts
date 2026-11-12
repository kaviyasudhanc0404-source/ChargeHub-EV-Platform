// JSON in localStorage / sessionStorage that never throws (private windows and blocked storage just don't remember)
type Store = "local" | "session";
const storeOf = (store: Store) => (store === "local" ? localStorage : sessionStorage);

export const readStored = <T,>(key: string, fallback: T, store: Store = "local"): T => {
  try {
    const saved = storeOf(store).getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const writeStored = (key: string, value: unknown, store: Store = "local") => {
  try {
    storeOf(store).setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked
  }
};
