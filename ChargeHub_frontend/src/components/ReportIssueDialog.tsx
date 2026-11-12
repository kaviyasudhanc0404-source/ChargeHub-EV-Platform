import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { reportAPI } from "@/services/api";
import { errorMessage } from "@/lib/format";
import { iconButton } from "@/lib/utils";

const CATEGORIES = [
  { value: "station", label: "Charging station" },
  { value: "booking", label: "Booking" },
  { value: "payment", label: "Payment" },
  { value: "account", label: "Account" },
  { value: "other", label: "Other" },
];

const EMPTY = { category: "station", subject: "", message: "" };

const ReportIssueDialog = () => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await reportAPI.create(form);
      toast.success(data.message);
      setForm(EMPTY);
      setOpen(false);
    } catch (error) {
      toast.error(errorMessage(error, "Could not submit the report"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className={iconButton} title="Report an issue" aria-label="Report an issue">
          <Flag className="h-[18px] w-[18px]" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report an issue</DialogTitle>
          <DialogDescription>Tell us what went wrong. An admin will review it and you'll be notified when it's resolved.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(category) => setForm({ ...form, category })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-subject">Subject</Label>
            <Input
              id="report-subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="e.g. Charger not working at Gobi bus stand"
              maxLength={120}
              required
              minLength={3}
             
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-message">Details</Label>
            <Textarea
              id="report-message"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Describe the issue (at least 10 characters)"
              rows={4}
              maxLength={2000}
              required
              minLength={10}
             
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Submit report
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReportIssueDialog;
