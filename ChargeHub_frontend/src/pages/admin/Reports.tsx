import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/PageHeader";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DataTable, { type Column } from "@/components/DataTable";
import ConfirmDialog, { type ConfirmRequest } from "@/components/ConfirmDialog";
import { reportAPI } from "@/services/api";
import { errorMessage, formatDate } from "@/lib/format";

interface Report {
  _id: string;
  reporterName: string;
  reporterRole: "user" | "provider";
  reporterId?: { email: string };
  category: string;
  subject: string;
  message: string;
  status: "pending" | "resolved";
  adminNote?: string;
  createdAt: string;
}

const Reports = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "resolved">("pending");
  const [resolving, setResolving] = useState<Report | null>(null);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  const fetchReports = () =>
    reportAPI
      .getAll()
      .then(({ data }) => setReports(data.data))
      .catch((error) => toast.error(errorMessage(error, "Failed to load reports")))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchReports();
  }, []);

  const run = async (action: Promise<{ data: { message: string } }>) => {
    setConfirm(null);
    setResolving(null);
    try {
      const { data } = await action;
      toast.success(data.message);
      fetchReports();
    } catch (error) {
      toast.error(errorMessage(error, "Action failed"));
    }
  };

  const visible = useMemo(() => reports.filter((r) => r.status === filter), [reports, filter]);
  const pendingCount = reports.filter((r) => r.status === "pending").length;

  const columns: Column<Report>[] = [
    {
      header: "Reporter",
      cell: (r) => (
        <div>
          <p className="font-semibold">{r.reporterName}</p>
          <p className="text-xs text-muted-foreground capitalize">{r.reporterRole}{r.reporterId?.email ? ` · ${r.reporterId.email}` : ""}</p>
        </div>
      ),
    },
    {
      header: "Issue",
      cell: (r) => (
        <div className="max-w-md">
          <p className="font-medium">{r.subject}</p>
          <p className="text-xs text-muted-foreground whitespace-pre-line">{r.message}</p>
          {r.adminNote && <p className="text-xs text-primary mt-1">Note: {r.adminNote}</p>}
        </div>
      ),
    },
    { header: "Category", cell: (r) => <Badge variant="outline" className="capitalize">{r.category}</Badge>, className: "hidden md:table-cell" },
    { header: "Date", cell: (r) => formatDate(r.createdAt), className: "hidden sm:table-cell" },
    {
      header: "Actions",
      cell: (r) => (
        <div className="flex gap-1">
          {r.status === "pending" && (
            <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" title="Mark resolved" onClick={() => { setNote(""); setResolving(r); }}>
              <CheckCircle className="w-4 h-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            title="Delete"
            onClick={() =>
              setConfirm({
                title: "Delete this report?",
                description: "The report will be removed permanently.",
                confirmLabel: "Delete",
                destructive: true,
                onConfirm: () => run(reportAPI.remove(r._id)),
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
      <PageHeader
        title="Reports & complaints"
        description="Issues reported by drivers and providers."
        actions={
          pendingCount > 0 && (
            <Badge variant="destructive" className="px-4 py-2 text-sm">
              <AlertCircle className="h-4 w-4" /> {pendingCount} pending
            </Badge>
          )
        }
      />

      <Card className="enter">
        <CardHeader>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList>
              <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
              <TabsTrigger value="resolved">Resolved ({reports.length - pendingCount})</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} rows={visible} rowKey={(r) => r._id} loading={loading} empty={`No ${filter} reports`} />
        </CardContent>
      </Card>

      <Dialog open={!!resolving} onOpenChange={(open) => !open && setResolving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve report</DialogTitle>
            <DialogDescription>{resolving?.subject}</DialogDescription>
          </DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note shown to the reporter" rows={3} maxLength={1000} />
          <Button onClick={() => resolving && run(reportAPI.resolve(resolving._id, note || undefined))}>
            <CheckCircle className="w-4 h-4 mr-2" /> Mark resolved
          </Button>
        </DialogContent>
      </Dialog>

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  );
};

export default Reports;
