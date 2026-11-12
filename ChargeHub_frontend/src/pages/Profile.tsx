import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bike, Car, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ProfileForm from "@/components/ProfileForm";
import ChangePasswordCard from "@/components/ChangePasswordCard";
import ConfirmDialog, { type ConfirmRequest } from "@/components/ConfirmDialog";
import { authAPI, providerAPI, userAPI } from "@/services/api";
import { ROLE_LABEL, useAuthStore } from "@/store/authStore";
import { avatarUrl, errorMessage, formatINR, getInitials } from "@/lib/format";

type Stats = Record<string, number | { gross: number }>;
type Tile = { label: string; value: (stats: Stats) => string };

// Headline numbers shown in the profile header for each role
const TILES: Record<"user" | "provider", { load: () => Promise<{ data: { data: Stats } }>; tiles: Tile[] }> = {
  user: {
    load: userAPI.getStats,
    tiles: [
      { label: "Upcoming", value: (s) => String(s.upcomingBookings ?? 0) },
      { label: "Charges", value: (s) => String(s.totalCharges ?? 0) },
      { label: "Spent", value: (s) => formatINR(Number(s.totalSpent) || 0) },
    ],
  },
  provider: {
    load: providerAPI.getStats,
    tiles: [
      { label: "Stations", value: (s) => String(s.totalStations ?? 0) },
      { label: "Sessions", value: (s) => String(s.completedBookings ?? 0) },
      { label: "Collected", value: (s) => formatINR((s.earnings as { gross: number })?.gross || 0) },
    ],
  },
};

const chip = "inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold";

// Profile page for drivers and providers: a header with who you are and your numbers, then your details, then
// password and account deletion side by side (everything stacks on phones)
const Profile = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const role = user?.role === "provider" ? "provider" : "user";

  useEffect(() => {
    TILES[role].load().then(({ data }) => setStats(data.data)).catch(() => undefined);
  }, [role]);

  const deleteAccount = async () => {
    setConfirm(null);
    try {
      const { data } = await authAPI.deleteAccount();
      logout();
      toast.success(data.message);
      navigate("/");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to delete account"));
    }
  };

  const vehicle = user?.vehicleInfo?.vehicleModel;
  const VehicleIcon = user?.vehicleInfo?.vehicleType === "bike" ? Bike : Car;
  const place = role === "provider" ? user?.businessInfo?.location : user?.defaultLocation;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 md:space-y-6">
      {/* Who you are */}
      <Card className="enter overflow-hidden">
        <div className="relative h-24 bg-energy sm:h-32">
          <div className="bg-grid absolute inset-0 opacity-40" />
        </div>
        <CardContent className="flex flex-col gap-5 px-5 pb-5 sm:px-7 sm:pb-6 md:flex-row md:items-center md:justify-between">
          {/* Only the photo overlaps the cover; the name sits below it */}
          <div className="flex min-w-0 flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:gap-5 sm:text-left">
            <Avatar className="-mt-12 h-24 w-24 shrink-0 border-4 border-card shadow-xl sm:-mt-14 sm:h-28 sm:w-28">
              <AvatarImage src={avatarUrl(user)} />
              <AvatarFallback className="bg-energy font-display text-4xl font-bold text-primary-foreground">{getInitials(user?.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 max-w-full sm:pt-4">
              <h1 className="truncate text-2xl font-bold">{user?.name}</h1>
              <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
              <div className="mt-2.5 flex flex-wrap justify-center gap-2 sm:justify-start">
                {user && <span className={`${chip} bg-primary/15 text-primary`}>{ROLE_LABEL[user.role]}</span>}
                {vehicle && (
                  <span className={`${chip} bg-muted text-muted-foreground`}>
                    <VehicleIcon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{vehicle}</span>
                  </span>
                )}
                {place && (
                  <span className={`${chip} bg-muted text-muted-foreground`} title={place}>
                    <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="max-w-[14rem] truncate">{place}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2.5 md:mt-4 md:w-[22rem] md:shrink-0">
            {TILES[role].tiles.map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-muted/60 px-3 py-2.5 text-center">
                <dd className="truncate font-display text-lg font-bold">{stats ? value(stats) : "—"}</dd>
                <dt className="text-xs text-muted-foreground">{label}</dt>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <ProfileForm title="Account information" />

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2 lg:items-start">
        <ChangePasswordCard />

        <Card className="enter border-destructive/40">
          <CardHeader className="flex-col gap-4 space-y-0 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-destructive">Delete account</CardTitle>
              <CardDescription>
                Cancels your upcoming bookings{role === "provider" ? " and removes your stations" : ""}. This cannot be undone.
              </CardDescription>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="w-full shrink-0 sm:w-auto"
              onClick={() =>
                setConfirm({ title: "Delete your account?", description: "This permanently deletes your account. This action cannot be undone.", confirmLabel: "Delete account", destructive: true, onConfirm: deleteAccount })
              }
            >
              <Trash2 /> Delete account
            </Button>
          </CardHeader>
        </Card>
      </div>

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
};

export default Profile;
