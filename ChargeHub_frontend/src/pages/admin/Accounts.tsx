import { useEffect, useMemo, useState } from "react";
import { Ban, CheckCircle, Download, Loader2, Search, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DataTable, { type Column } from "@/components/DataTable";
import ConfirmDialog, { type ConfirmRequest } from "@/components/ConfirmDialog";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { adminAPI } from "@/services/api";
import { useAuthStore, type Role } from "@/store/authStore";
import { downloadCSV } from "@/lib/csv";
import { errorMessage, formatDate } from "@/lib/format";

interface Account {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  vehicleInfo?: { vehicleModel?: string };
  businessInfo?: { location?: string; upiId?: string };
}

const TITLES: Record<Role, { title: string; subtitle: string; noun: string }> = {
  user: { title: "Manage Users", subtitle: "View and manage registered EV drivers", noun: "user" },
  provider: { title: "Manage Providers", subtitle: "Approve and manage charging station providers", noun: "provider" },
  admin: { title: "Admin Management", subtitle: "Add and manage platform administrators", noun: "admin" },
};

const EMPTY_ADMIN = { name: "", email: "", password: "" };

// One page for users, providers and admins (selected by the route)
const Accounts = ({ role }: { role: Role }) => {
  const { user: me } = useAuthStore();
  const { title, subtitle, noun } = TITLES[role];
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [newAdmin, setNewAdmin] = useState(EMPTY_ADMIN);
  const [adding, setAdding] = useState(false);

  const fetchAccounts = () => {
    setLoading(true);
    adminAPI
      .getUsers({ role, limit: 200 })
      .then(({ data }) => setAccounts(data.data))
      .catch((error) => toast.error(errorMessage(error, `Failed to load ${noun}s`)))
      .finally(() => setLoading(false));
  };

  useEffect(fetchAccounts, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (action: Promise<{ data: { message: string } }>) => {
    setConfirm(null);
    try {
      const { data } = await action;
      toast.success(data.message);
      fetchAccounts();
    } catch (error) {
      toast.error(errorMessage(error, "Action failed"));
    }
  };

  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const { data } = await adminAPI.addAdmin(newAdmin);
      toast.success(data.message);
      setNewAdmin(EMPTY_ADMIN);
      fetchAccounts();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to add admin"));
    } finally {
      setAdding(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return accounts.filter((a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
  }, [accounts, search]);

  const exportCSV = () =>
    downloadCSV(`${noun}s-${new Date().toISOString().slice(0, 10)}.csv`, filtered.map((a) => ({
      Name: a.name,
      Email: a.email,
      Phone: a.phone,
      ...(role === "user" && { Vehicle: a.vehicleInfo?.vehicleModel }),
      ...(role === "provider" && { "Business address": a.businessInfo?.location, "UPI ID": a.businessInfo?.upiId }),
      Status: a.isActive ? "Active" : "Blocked",
      Verified: a.isVerified ? "Yes" : "No",
      Registered: formatDate(a.createdAt),
    })));

  const columns: Column<Account>[] = [
    {
      header: "Name",
      cell: (a) => (
        <div>
          <p className="font-semibold">{a.name}</p>
        </div>
      ),
    },
    { header: "Email", cell: (a) => a.email, className: "hidden md:table-cell" },
    ...(role === "user" ? [{ header: "Vehicle", cell: (a: Account) => a.vehicleInfo?.vehicleModel || "—", className: "hidden lg:table-cell" }] : []),
    ...(role === "provider" ? [{ header: "Business", cell: (a: Account) => a.businessInfo?.location || "—", className: "hidden lg:table-cell" }] : []),
    { header: "Registered", cell: (a) => formatDate(a.createdAt), className: "hidden sm:table-cell" },
    {
      header: "Status",
      cell: (a) => (
        <div className="flex flex-col gap-1 items-start">
          <StatusBadge status={a.isActive ? "active" : "blocked"} />
          {!a.isVerified && role !== "admin" && <StatusBadge status="pending" label="Needs approval" />}
        </div>
      ),
    },
    {
      header: "Actions",
      cell: (a) =>
        a._id === me?.id ? (
          <span className="text-xs text-muted-foreground">You</span>
        ) : (
          <div className="flex gap-1">
            {!a.isVerified && role !== "admin" && (
              <Button size="sm" variant="ghost" className="text-primary" title="Approve" onClick={() => run(adminAPI.approveUser(a._id))}>
                <CheckCircle className="w-4 h-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className={a.isActive ? "text-accent" : "text-primary"}
              title={a.isActive ? "Block" : "Unblock"}
              onClick={() =>
                setConfirm({
                  title: `${a.isActive ? "Block" : "Unblock"} ${a.name}?`,
                  description: a.isActive ? "They will not be able to sign in until unblocked." : "This restores their access.",
                  confirmLabel: a.isActive ? "Block" : "Unblock",
                  destructive: a.isActive,
                  onConfirm: () => run(adminAPI.blockUser(a._id, a.isActive)),
                })
              }
            >
              {a.isActive ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              title="Delete"
              onClick={() =>
                setConfirm({
                  title: `Delete ${a.name}?`,
                  description: `This permanently deletes the ${noun} account${role === "provider" ? " and takes their stations offline" : ""}.`,
                  confirmLabel: "Delete",
                  destructive: true,
                  onConfirm: () => run(adminAPI.deleteUser(a._id)),
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
        title={title}
        description={`${subtitle} · ${accounts.length} total`}
        actions={
          <Button onClick={exportCSV} disabled={!filtered.length} variant="outline">
            <Download /> Export CSV
          </Button>
        }
      />

      {role === "admin" && (
        <Card className="enter">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Add new admin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addAdmin} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="admin-name">Full name</Label>
                <Input id="admin-name" required value={newAdmin.name} onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input id="admin-email" type="email" required value={newAdmin.email} onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password (min. 6)</Label>
                <Input id="admin-password" type="password" required minLength={6} value={newAdmin.password} onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })} />
              </div>
              <Button type="submit" disabled={adding}>
                {adding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                Add admin
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="enter">
        <CardHeader>
          <div className="relative sm:max-w-sm">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} rows={filtered} rowKey={(a) => a._id} loading={loading} empty={`No ${noun}s found`} />
        </CardContent>
      </Card>

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  );
};

export default Accounts;
