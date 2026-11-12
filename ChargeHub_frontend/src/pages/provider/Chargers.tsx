import { useEffect, useMemo, useState } from "react";
import { Plus, MapPin, Pencil, Save, Trash2, Building2, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LocationPicker from "@/components/LocationPicker";
import ConfirmDialog, { type ConfirmRequest } from "@/components/ConfirmDialog";
import PageLoader from "@/components/PageLoader";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import { stationAPI } from "@/services/api";
import { errorMessage, errorReason, formatClock } from "@/lib/format";

type Point = { lat: number; lng: number };

interface Station {
  _id: string;
  name: string;
  location: { address: string; city: string; state: string; pincode?: string; coordinates: Point };
  chargerType: string;
  power: number;
  vehicleType: string;
  connectorTypes: string[];
  pricing: { ratePerHour: number };
  availability: { isAvailable: boolean };
  operatingHours?: { open: string; close: string; is24x7: boolean };
  isVerified: boolean;
}

// Charger catalogue: power, supported vehicles, connectors and example compatible vehicles
const CHARGERS: Record<string, { power: number; vehicleType: "car" | "bike" | "both"; name: string; connectors: Record<string, string> }> = {
  "Level 1 (3kW)": { power: 3, vehicleType: "bike", name: "Slow AC Charger", connectors: { "Type 1": "Ather 450X, Ola S1 Pro, TVS iQube, Bajaj Chetak, Simple One" } },
  "Level 2 (11kW)": { power: 11, vehicleType: "both", name: "Standard AC Charger", connectors: { "Type 2": "Tata Nexon EV, MG ZS EV, Hyundai Kona, Ather 450X, Ola S1 Pro" } },
  "Level 2 (22kW)": { power: 22, vehicleType: "car", name: "Fast AC Charger", connectors: { "Type 2": "Tata Nexon EV Max, Tata Tigor EV, MG ZS EV, BYD e6" } },
  "DC Fast Charger (50kW)": { power: 50, vehicleType: "car", name: "DC Fast Charger", connectors: { CCS: "Tata Nexon EV Max, MG ZS EV, Hyundai Ioniq 5, Kia EV6, BYD Atto 3", CHAdeMO: "Nissan Leaf, older Hyundai Kona models" } },
  "DC Fast Charger (100kW)": { power: 100, vehicleType: "car", name: "Ultra Fast DC Charger", connectors: { CCS: "Hyundai Ioniq 5, Kia EV6, BYD Atto 3, Volvo XC40 Recharge", CHAdeMO: "Nissan Leaf Plus, Nissan Ariya" } },
  "DC Fast Charger (150kW)": { power: 150, vehicleType: "car", name: "Superfast DC Charger", connectors: { CCS: "Hyundai Ioniq 5, Kia EV6 GT, Porsche Taycan, BMW iX" } },
  "DC Ultra Fast (350kW)": { power: 350, vehicleType: "car", name: "Ultra Fast DC Charger", connectors: { CCS: "Porsche Taycan Turbo S, Audi e-tron GT, Kia EV6 GT" } },
};

const EMPTY_FORM = {
  stationName: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  coords: null as Point | null,
  vehicle: "car" as "car" | "bike",
  chargerType: "",
  connector: "",
  rate: "",
  is24x7: true,
  open: "06:00",
  close: "22:00",
};

// Chargers at the same place are grouped as one station. Each charger is saved as "<station name> - <charger name>".
const groupKey = (s: Station) => `${s.location.address}|${s.location.coordinates.lat.toFixed(5)}|${s.location.coordinates.lng.toFixed(5)}`;
// Split at the last separator: charger names never contain one, but a station name may ("Erode - Bus Stand Hub")
const NAME_SEPARATOR = " - ";
const splitName = (name: string): [station: string, charger: string] => {
  const index = name.lastIndexOf(NAME_SEPARATOR);
  return index < 0 ? [name, ""] : [name.slice(0, index), name.slice(index + NAME_SEPARATOR.length)];
};
const baseName = (name: string) => splitName(name)[0];
const chargerName = (name: string) => splitName(name)[1];
const fullName = (station: string, charger: string) => [station.trim(), charger].filter(Boolean).join(NAME_SEPARATOR);

const ADDRESS_FIELDS = ["address", "city", "state", "pincode"] as const;
const sameLocation = (a: Station["location"], b: Station["location"]) =>
  ADDRESS_FIELDS.every((key) => (a[key] || "") === (b[key] || "")) &&
  a.coordinates.lat === b.coordinates.lat &&
  a.coordinates.lng === b.coordinates.lng;

const Chargers = () => {
  const [stations, setStations] = useState<Station[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<Station[] | null>(null); // the chargers of the station being edited
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  const fetchStations = () =>
    stationAPI
      .getMyStations()
      .then(({ data }) => setStations(data.data))
      .catch((error) => toast.error(errorMessage(error, "Failed to load your stations")));

  useEffect(() => {
    fetchStations();
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, Station[]>();
    (stations || []).forEach((s) => map.set(groupKey(s), [...(map.get(groupKey(s)) || []), s]));
    return [...map.values()];
  }, [stations]);

  // Add a charger (optionally at an existing station's location), or edit a station's name and location: `edit` = its chargers
  const openDialog = (location?: Station, edit: Station[] | null = null) => {
    setForm(
      location
        ? {
            ...EMPTY_FORM,
            stationName: baseName(location.name),
            address: location.location.address,
            city: location.location.city,
            state: location.location.state,
            pincode: location.location.pincode || "",
            coords: location.location.coordinates,
          }
        : EMPTY_FORM
    );
    setEditing(edit);
    setDialogOpen(true);
  };

  // `pinConfirmed`: the provider has confirmed a pin that is far from the area named in the address
  const save = async (pinConfirmed = false) => {
    const charger = CHARGERS[form.chargerType];
    const stationName = form.stationName.trim();
    if (!stationName) return toast.error("Enter the station name");
    if (!editing && (!charger || !form.connector)) return toast.error("Choose the charger and connector type");
    if (!form.coords) return toast.error("Place the station pin on the map");

    const location = {
      address: form.address.trim(), city: form.city.trim(), state: form.state.trim(), pincode: form.pincode.trim(), coordinates: form.coords,
    };
    setSaving(true);
    try {
      if (editing) {
        // Send only what changed, so a rename alone doesn't re-check the map pin
        const renamed = stationName !== baseName(editing[0].name);
        const moved = !sameLocation(editing[0].location, location);
        if (renamed || moved) {
          await Promise.all(
            editing.map((c) =>
              stationAPI.updateStation(c._id, {
                ...(renamed && { name: fullName(stationName, chargerName(c.name)) }),
                ...(moved && { location: { ...location, pinConfirmed } }),
              })
            )
          );
          toast.success("Station updated");
        }
      } else {
        const { data } = await stationAPI.createStation({
          name: fullName(stationName, charger.name),
          location: { ...location, pinConfirmed },
          chargerType: form.chargerType,
          power: charger.power,
          vehicleType: charger.vehicleType,
          connectorTypes: [form.connector],
          pricing: { ratePerHour: Number(form.rate) },
          operatingHours: form.is24x7 ? { open: "00:00", close: "23:59", is24x7: true } : { open: form.open, close: form.close, is24x7: false },
        });
        toast.success(data.message);
      }
      setDialogOpen(false);
      fetchStations();
    } catch (error) {
      if (errorReason(error) === "PIN_CONFIRM") {
        setConfirm({
          title: "Is the pin at the charger?",
          description: `${errorMessage(error)} Drivers are guided to the pin.`,
          confirmLabel: "Yes, the pin is right",
          onConfirm: () => {
            setConfirm(null);
            save(true);
          },
        });
      } else {
        toast.error(errorMessage(error, editing ? "Failed to update the station" : "Failed to add charger"));
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleOnline = async (station: Station) => {
    try {
      const { data } = await stationAPI.setAvailability(station._id, !station.availability.isAvailable);
      toast.success(data.message);
      fetchStations();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update status"));
    }
  };

  const remove = (chargers: Station[], label: string) =>
    setConfirm({
      title: `Delete ${label}?`,
      description: "Users will no longer see or book it.",
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await Promise.all(chargers.map((c) => stationAPI.deleteStation(c._id)));
          toast.success("Deleted");
          fetchStations();
        } catch (error) {
          toast.error(errorMessage(error, "Failed to delete"));
        }
      },
    });

  if (!stations) return <PageLoader label="Loading your stations..." />;

  const selected = CHARGERS[form.chargerType];

  return (
    <>
      <PageHeader
        title="My stations"
        description="New chargers become visible to drivers after admin approval."
        actions={
          <Button onClick={() => openDialog()}>
            <Plus /> Add charging point
          </Button>
        }
      />

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="No charging stations yet"
            description="Add your first charger to start receiving bookings."
            action={<Button onClick={() => openDialog()}><Plus /> Add charging point</Button>}
          />
        </Card>
      ) : (
        groups.map((chargers, index) => {
          const first = chargers[0];
          const online = chargers.filter((c) => c.availability.isAvailable).length;
          return (
            <Card key={groupKey(first)} className="enter overflow-hidden" style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}>
              <div className="flex flex-col justify-between gap-4 border-b border-border/70 bg-gradient-to-r from-primary/10 to-transparent p-5 md:flex-row md:items-center">
                <div className="flex min-w-0 items-center gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
                    <Zap className="h-6 w-6 fill-current" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold">{baseName(first.name)}</h2>
                    <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0" /> {first.location.address}, {first.location.city}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1 text-sm text-muted-foreground">{online}/{chargers.length} online</span>
                  <Button size="sm" variant="outline" onClick={() => openDialog(first, chargers)}>
                    <Pencil /> Edit station
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openDialog(first)}>
                    <Plus /> Add charger here
                  </Button>
                  <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive hover:bg-destructive/10" title="Delete station" onClick={() => remove(chargers, `${baseName(first.name)} and all its chargers`)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {chargers.map((c) => (
                  <div key={c._id} className="space-y-2.5 rounded-xl border border-border/70 bg-background/50 p-4 text-sm transition-colors hover:border-primary/40">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{c.chargerType}</span>
                      <StatusBadge status={c.isVerified ? "live" : "pending"} />
                    </div>
                    <p className="text-muted-foreground">{c.connectorTypes.join(", ")} · <span className="capitalize">{c.vehicleType}</span></p>
                    <div className="flex items-baseline justify-between">
                      <p className="font-display text-lg font-bold text-primary">₹{c.pricing.ratePerHour}<span className="text-xs font-normal text-muted-foreground">/hour</span></p>
                      <p className="text-xs text-muted-foreground">{c.operatingHours?.is24x7 === false ? `${formatClock(c.operatingHours.open)} – ${formatClock(c.operatingHours.close)}` : "Open 24×7"}</p>
                    </div>
                    <div className="flex items-center justify-between border-t border-border/60 pt-3">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Switch checked={c.availability.isAvailable} onCheckedChange={() => toggleOnline(c)} />
                        {c.availability.isAvailable ? "Online" : "Offline"}
                      </label>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" title="Delete charger" onClick={() => remove([c], "this charger")}>
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${baseName(editing[0].name)}` : "Add charging point"}</DialogTitle>
            <DialogDescription>
              {editing && editing.length > 1 ? `Changes apply to all ${editing.length} chargers at this station. ` : ""}
              Place the pin exactly at the charger so drivers get accurate distances and directions.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="stationName">Station name</Label>
              <Input id="stationName" required value={form.stationName} onChange={(e) => setForm({ ...form, stationName: e.target.value })} placeholder="e.g. Gobi Bus Stand EV Hub" />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, landmark, plus code (e.g. Bus stand, FC3P+W5P)" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City / town</Label>
              <Input id="city" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="e.g. Gobichettipalayam" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="e.g. Tamil Nadu" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pincode">Pincode</Label>
              <Input id="pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} placeholder="e.g. 638452" />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Exact location</Label>
              {dialogOpen && (
                <LocationPicker
                  value={form.coords}
                  onChange={(coords) => setForm((f) => ({ ...f, coords }))}
                  address={{ address: form.address, city: form.city, state: form.state }}
                />
              )}
            </div>

            {!editing && (
              <>
                <div className="space-y-2">
                  <Label>Vehicle type</Label>
                  <Select value={form.vehicle} onValueChange={(vehicle: "car" | "bike") => setForm({ ...form, vehicle, chargerType: "", connector: "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="car">Car</SelectItem>
                      <SelectItem value="bike">Bike</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Charger type</Label>
                  <Select value={form.chargerType} onValueChange={(chargerType) => setForm({ ...form, chargerType, connector: "" })}>
                    <SelectTrigger><SelectValue placeholder="Select charger" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CHARGERS)
                        .filter(([, c]) => c.vehicleType === form.vehicle || c.vehicleType === "both")
                        .map(([key, c]) => (
                          <SelectItem key={key} value={key}>{key} · {c.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {selected && (
                  <div className="space-y-2">
                    <Label>Connector</Label>
                    <Select value={form.connector} onValueChange={(connector) => setForm({ ...form, connector })}>
                      <SelectTrigger><SelectValue placeholder="Select connector" /></SelectTrigger>
                      <SelectContent>
                        {Object.keys(selected.connectors).map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="rate">Rate per hour (₹)</Label>
                  <Input id="rate" type="number" min={1} required value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="e.g. 50" />
                </div>
                {selected && form.connector && (
                  <p className="md:col-span-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Compatible vehicles:</span> {selected.connectors[form.connector]}
                  </p>
                )}

                <div className="md:col-span-2 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={form.is24x7} onCheckedChange={(is24x7) => setForm({ ...form, is24x7 })} /> Open 24×7
                  </label>
                  {!form.is24x7 && (
                    <>
                      <Input type="time" value={form.open} onChange={(e) => setForm({ ...form, open: e.target.value })} className="w-32" aria-label="Opening time" />
                      <span className="text-muted-foreground">to</span>
                      <Input type="time" value={form.close} onChange={(e) => setForm({ ...form, close: e.target.value })} className="w-32" aria-label="Closing time" />
                    </>
                  )}
                </div>
              </>
            )}

            <Button type="submit" size="lg" disabled={saving} className="md:col-span-2">
              {saving ? <Loader2 className="animate-spin" /> : editing ? <Save /> : <Zap />}
              {editing ? "Save changes" : "Submit for approval"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  );
};

export default Chargers;
