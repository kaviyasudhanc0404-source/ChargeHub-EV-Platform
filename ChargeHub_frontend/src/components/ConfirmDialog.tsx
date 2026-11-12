import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ConfirmRequest {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}

// Controlled confirmation dialog: render with a request to open it, null to close it
const ConfirmDialog = ({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) => (
  <AlertDialog open={!!request} onOpenChange={(open) => !open && onClose()}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{request?.title}</AlertDialogTitle>
        <AlertDialogDescription>{request?.description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={() => request?.onConfirm()}
          className={request?.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
        >
          {request?.confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default ConfirmDialog;
