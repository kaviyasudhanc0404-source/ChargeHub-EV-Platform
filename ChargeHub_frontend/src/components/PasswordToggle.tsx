import { Eye, EyeOff } from "lucide-react";

// Show / hide button placed inside a password input
const PasswordToggle = ({ shown, onToggle }: { shown: boolean; onToggle: () => void }) => (
  <button
    type="button"
    onClick={onToggle}
    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
    aria-label={shown ? "Hide password" : "Show password"}
  >
    {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
  </button>
);

export default PasswordToggle;
