import { useEffect, useMemo, useState } from "react";
import { CheckCircle, ExternalLink, Search, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DataTable, { type Column } from "@/components/DataTable";
import ConfirmDialog, { type ConfirmRequest } from "@/components/ConfirmDialog";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { adminAPI, stationAPI } from "@/services/api";
import { errorMessage, formatINR } from "@/lib/format";

interface Station {
  _id: string;
  name: string;
  providerId?: { name: string; email: string; phone?: string };
  location: { address: string; city: string; coordinates: { lat: number; lng: number } };
  pricing: { ratePerHour: number };
  chargerType: string;
  isVerified: boolean;
  totalBookings: number;
  availability: { isAvailable: boolean };
}

const FILTERS = { all: () => true, pending: (s: Station) => !s.isVerified, approved: (s: Station) => s.isVerified };

const Stations = () => {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<keyof typeof FILTERS>("pending");
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  const fetchStations = () =>
    adminAPI
      .getStations({ limit: 200 })
      .then(({ data }) => setStations(data.data))
      .catch((error) => toast.error(errorMessage(error, "Failed to load stations")))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchStations();
  }, []);

  const run = async (action: Promise<{ data: { message: string } }>) => {
    setConfirm(null);
    try {
      const { data } = await action;
      toast.success(data.message);
      fetchStations();
    } catch (error) {
      toast.error(errorMessage(error, "Action failed"));
    }
  };

  const visible = useMemo(() => {
    const q = search.toLowerCase();
    return stations
      .filter(FILTERS[filter])
      .filter((s) => [s.name, s.location.city, s.providerId?.name].some((v) => v?.toLowerCase().includes(q)));
  }, [stations, filter, search]);

  const columns: Column<Station>[] = [
    {
      header: "Station",
      cell: (s) => (
        <div>
          <p className="font-semibold">{s.name}</p>
          <p className="text-xs text-muted-foreground">{s.chargerType}</p>
        </div>
      ),
    },
    {
      header: "Location",
      cell: (s) => (
        <a
          href={`https://www.openstreetmap.org/?mlat=${s.location.coordinates.lat}&mlon=${s.location.coordinates.lng}#map=17/${s.location.coordinates.lat}/${s.location.coordinates.lng}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
          title="Check the pinned location before approving"
        >
          {s.location.city} <ExternalLink className="w-3 h-3" />
        </a>
      ),
      className: "hidden md:table-cell",
    },
    { header: "Provider", cell: (s) => s.providerId?.name || "Deleted provider", className: "hidden lg:table-cell" },
    { header: "Rate", cell: (s) => `${formatINR(s.pricing.ratePerHour)}/h`, className: "hidden sm:table-cell" },
    { header: "Bookings", cell: (s) => s.totalBookings, className: "hidden lg:table-cell" },
    {
      header: "Status",
      cell: (s) => (
        <StatusBadge status={s.isVerified ? "approved" : "pending"} />
      ),
    },
    {
      header: "Actions",
      cell: (s) => (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className={s.isVerified ? "text-accent" : "text-primary"}
            title={s.isVerified ? "Revoke approval" : "Approve"}
            onClick={() => run(adminAPI.verifyStation(s._id, !s.isVerified))}
          >
            {s.isVerified ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            title="Delete"
            onClick={() =>
              setConfirm({
                title: `Delete ${s.name}?`,
                description: "The station will be removed from the platform.",
                confirmLabel: "Delete",
                destructive: true,
                onConfirm: () => run(stationAPI.deleteStation(s._id)),
              })
            }
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Charging stations" description="Check each station's pinned location, then approve it to make it visible to drivers." />

      <Card className="enter">
        <CardHeader className="flex flex-col gap-4 space-y-0 md:flex-row md:items-center md:justify-between">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as keyof typeof FILTERS)}>
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="pending">Pending ({stations.filter(FILTERS.pending).length})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({stations.filter(FILTERS.approved).length})</TabsTrigger>
              <TabsTrigger value="all">All ({stations.length})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative md:w-80">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search station, city or provider..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} rows={visible} rowKey={(s) => s._id} loading={loading} empty="No stations here" />
        </CardContent>
      </Card>

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  );
};

export default Stations;
