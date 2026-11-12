import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import ProfileForm from "@/components/ProfileForm";
import ChangePasswordCard from "@/components/ChangePasswordCard";
import PageLoader from "@/components/PageLoader";
import PageHeader from "@/components/PageHeader";
import { adminAPI } from "@/services/api";
import { errorMessage } from "@/lib/format";

interface SystemSettings {
  userRegistration: boolean;
  providerRegistration: boolean;
  maintenanceMode: boolean;
  platformFeePercent: number;
}

const TOGGLES: { key: keyof Omit<SystemSettings, "platformFeePercent">; title: string; description: string; danger?: boolean }[] = [
  { key: "userRegistration", title: "User registration", description: "Allow new EV drivers to sign up" },
  { key: "providerRegistration", title: "Provider registration", description: "Allow new charging providers to sign up" },
  { key: "maintenanceMode", title: "Maintenance mode", description: "Temporarily block users and providers (admins keep access)", danger: true },
];

const Settings = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminAPI.getSettings().then(({ data }) => setSettings(data.data)).catch((error) => toast.error(errorMessage(error, "Failed to load settings")));
  }, []);

  const saveSystem = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { data } = await adminAPI.updateSettings({ ...settings });
      setSettings(data.data);
      toast.success(data.message);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" description="Your admin profile and the platform configuration." />

      <div className="grid gap-4 md:gap-6 xl:grid-cols-2 xl:items-start">
      <div className="space-y-4 md:space-y-6">
        <ProfileForm title="Admin profile" />
        <ChangePasswordCard />
      </div>

      <Card className="enter">
        <CardHeader>
          <CardTitle>System configuration</CardTitle>
        </CardHeader>
        <CardContent>
          {!settings ? (
            <PageLoader />
          ) : (
            <div className="space-y-3">
              {TOGGLES.map((toggle) => (
                <div key={toggle.key} className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4">
                  <div>
                    <h3 className={`font-semibold mb-1 ${toggle.danger ? "text-destructive" : "text-foreground"}`}>{toggle.title}</h3>
                    <p className="text-sm text-muted-foreground">{toggle.description}</p>
                  </div>
                  <Switch checked={settings[toggle.key]} onCheckedChange={(checked) => setSettings({ ...settings, [toggle.key]: checked })} />
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4">
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Platform fee (%)</h3>
                  <p className="text-sm text-muted-foreground">Commission recorded on each completed session (0–50%)</p>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  value={settings.platformFeePercent}
                  onChange={(e) => setSettings({ ...settings, platformFeePercent: Number(e.target.value) })}
                  className="w-24 shrink-0"
                />
              </div>
              <Button onClick={saveSystem} disabled={saving} className="mt-2 w-full md:w-auto">
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                Save system settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </>
  );
};

export default Settings;
