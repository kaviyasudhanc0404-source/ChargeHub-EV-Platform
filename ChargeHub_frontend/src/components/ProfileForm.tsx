import { useEffect, useState, type ReactNode } from "react";
import { Car, Loader2, Mail, MapPin, Pencil, Phone, Save, User as UserIcon, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LocationSearch from "@/components/LocationSearch";
import { authAPI, geoAPI, type LatLng } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { VEHICLE_TEXT, errorMessage } from "@/lib/format";
import { cn } from "@/lib/utils";

const EMPTY = {
  name: "",
  email: "",
  phone: "",
  vehicleModel: "",
  vehicleType: "car",
  defaultLocation: "",
  defaultCoordinates: null as LatLng | null,
  businessLocation: "",
  upiId: "",
};

type FormState = typeof EMPTY;

type TextField = Exclude<keyof FormState, "defaultCoordinates">;

interface FieldProps {
  label: string;
  icon: typeof Mail;
  htmlFor?: string;
  editing: boolean;
  value: string; // shown when not editing
  className?: string;
  children: ReactNode; // the editor
}

// A labelled detail: plain value when viewing, its editor when editing
const Field = ({ label, icon: Icon, htmlFor, editing, value, className, children }: FieldProps) => (
  <div className={cn("space-y-2", className)}>
    <Label htmlFor={htmlFor} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <Icon className="h-4 w-4 text-primary" /> {label}
    </Label>
    {editing ? (
      children
    ) : (
      <p className="flex min-h-11 items-center break-all rounded-xl bg-muted/40 px-3.5 py-2 text-sm">
        {value || <span className="text-muted-foreground">Not set</span>}
      </p>
    )}
  </div>
);

// Account details card shared by the user, provider and admin pages: read-only until "Edit profile"
const ProfileForm = ({ title, description = "Your personal and contact details." }: { title: string; description?: string }) => {
  const { user, updateUser } = useAuthStore();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saved, setSaved] = useState<FormState | null>(null); // last loaded/saved values, restored on Cancel
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locationText, setLocationText] = useState(""); // what the default-location box shows while editing
  const role = user?.role;

  useEffect(() => {
    authAPI.getMe().then(({ data }) => {
      const me = data.data;
      const loaded = {
        ...EMPTY,
        name: me.name || "",
        email: me.email || "",
        phone: me.phone || "",
        vehicleModel: me.vehicleInfo?.vehicleModel || "",
        vehicleType: me.vehicleInfo?.vehicleType || "car",
        defaultLocation: me.defaultLocation || "",
        defaultCoordinates: me.defaultCoordinates?.lat != null ? me.defaultCoordinates : null,
        businessLocation: me.businessInfo?.location || "",
        upiId: me.businessInfo?.upiId || "",
      };
      setForm(loaded);
      setSaved(loaded);
    }).catch((error) => toast.error(errorMessage(error, "Failed to load your profile")));
  }, []);

  // A text detail with its input
  const text = (key: TextField, label: string, icon: typeof Mail, props: React.InputHTMLAttributes<HTMLInputElement> = {}, className?: string) => (
    <Field label={label} icon={icon} htmlFor={key} editing={editing} value={form[key]} className={className}>
      <Input id={key} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...props} />
    </Field>
  );

  const startEditing = () => {
    setLocationText(form.defaultLocation);
    setEditing(true);
  };

  // The default location to save: the picked place, the best match for text typed without picking a suggestion,
  // or none when the box was cleared (the device location is used then)
  const resolveLocation = async (): Promise<Pick<FormState, "defaultLocation" | "defaultCoordinates"> | null> => {
    const typed = locationText.trim();
    if (typed === form.defaultLocation.trim()) return { defaultLocation: form.defaultLocation, defaultCoordinates: form.defaultCoordinates };
    if (!typed) return { defaultLocation: "", defaultCoordinates: null };
    const { data } = await geoAPI.search(typed, form.defaultCoordinates);
    const best = data.data[0];
    if (!best) {
      toast.error(`Couldn't find "${typed}". Try a nearby town or landmark and pick it from the list.`);
      return null;
    }
    return { defaultLocation: best.label, defaultCoordinates: { lat: best.lat, lng: best.lng } };
  };

  const cancel = () => {
    if (saved) setForm(saved);
    setEditing(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const update: Record<string, unknown> = { name: form.name, email: form.email, phone: form.phone };
      let next = form;
      if (role === "user") {
        const location = await resolveLocation();
        if (!location) return;
        next = { ...form, ...location };
        update.vehicleInfo = { vehicleModel: form.vehicleModel, vehicleName: form.vehicleModel, vehicleType: form.vehicleType };
        update.defaultLocation = location.defaultLocation;
        update.defaultCoordinates = location.defaultCoordinates;
      }
      if (role === "provider") update.businessInfo = { location: form.businessLocation, upiId: form.upiId };

      const { data } = await authAPI.updateProfile(update);
      const me = data.data;
      updateUser({
        name: me.name,
        email: me.email,
        phone: me.phone,
        vehicleInfo: me.vehicleInfo,
        defaultLocation: me.defaultLocation,
        defaultCoordinates: me.defaultCoordinates,
        businessInfo: me.businessInfo,
      });
      // Show what the server saved (e.g. the email in lower case), not just what was typed
      next = { ...next, name: me.name, email: me.email, phone: me.phone || "" };
      setForm(next);
      setSaved(next);
      setEditing(false);
      toast.success(data.message);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update profile"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="enter">
      <form onSubmit={save}>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{editing ? "Update your details, then save." : description}</CardDescription>
          </div>
          {!editing && (
            <Button type="button" variant="outline" size="sm" onClick={startEditing} disabled={!saved} className="shrink-0">
              <Pencil /> Edit profile
            </Button>
          )}
        </CardHeader>

        <CardContent>
          {!saved ? (
            <div className="grid h-40 place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {text("name", "Full name", UserIcon, { required: true, autoFocus: true })}
              {text("email", "Email", Mail, { type: "email", required: true })}
              {text("phone", "Phone", Phone, { type: "tel", placeholder: "+91 9876543210" })}

              {role === "user" && (
                <>
                  {text("vehicleModel", "Vehicle model", Car, { placeholder: "e.g. Tata Nexon EV, Ather 450X" })}
                  <Field label="Vehicle type" icon={Car} editing={editing} value={VEHICLE_TEXT[form.vehicleType as keyof typeof VEHICLE_TEXT]}>
                    <Select value={form.vehicleType} onValueChange={(vehicleType) => setForm({ ...form, vehicleType })}>
                      <SelectTrigger aria-label="Vehicle type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="car">Car</SelectItem>
                        <SelectItem value="bike">Bike</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Default location" icon={MapPin} editing={editing} value={form.defaultLocation}>
                    <LocationSearch
                      near={form.defaultCoordinates}
                      defaultValue={form.defaultLocation}
                      onTextChange={setLocationText}
                      onSelect={(place) => setForm((f) => ({ ...f, defaultLocation: place.label, defaultCoordinates: { lat: place.lat, lng: place.lng } }))}
                      placeholder="Search your village/town, or paste a plus code like C6FH+9XW Ukkaram"
                    />
                    <p className="text-xs text-muted-foreground">
                      Distances to stations are measured from here. Pick a place from the list, or clear the box to use your device's location.
                    </p>
                  </Field>
                </>
              )}

              {role === "provider" && (
                <>
                  {text("upiId", "UPI ID", Wallet, { placeholder: "yourname@upi" })}
                  {text("businessLocation", "Business address", MapPin, {}, "sm:col-span-2")}
                </>
              )}

            </div>
          )}
        </CardContent>

        {editing && (
          <CardFooter className="flex-col-reverse gap-3 border-t border-border/70 pt-6 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={cancel} disabled={saving} className="w-full sm:w-auto">
              <X /> Cancel
            </Button>
            <Button type="submit" disabled={saving} className="w-full sm:w-auto sm:min-w-[160px]">
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              Save changes
            </Button>
          </CardFooter>
        )}
      </form>
    </Card>
  );
};

export default ProfileForm;
