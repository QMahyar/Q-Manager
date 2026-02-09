import { ReactNode, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle, IconTrash, IconLoader2 } from "@tabler/icons-react";
import { uiLogger } from "@/lib/logger";

interface ConfirmDialogProps {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
}

/**
 * Reusable confirmation dialog for destructive or important actions.
 * Supports async onConfirm with loading state.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  onConfirm,
  disabled = false,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch (error) {
      uiLogger.logError(error, "Confirm action failed", { source: "ConfirmDialog" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        className={disabled ? "pointer-events-none opacity-50" : ""}
        render={<span>{trigger}</span>}
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {variant === "destructive" && (
              <IconAlertTriangle className="h-5 w-5 text-destructive" />
            )}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={loading}
            className={variant === "destructive" ? "bg-destructive hover:bg-destructive/90" : ""}
          >
            {loading && <IconLoader2 className="size-4 mr-2 animate-spin" />}
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Pre-configured delete confirmation dialog
 */
export function DeleteConfirmDialog({
  itemName,
  itemType = "item",
  onDelete,
  trigger,
  disabled = false,
}: {
  itemName: string;
  itemType?: string;
  onDelete: () => void | Promise<void>;
  trigger?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <ConfirmDialog
      trigger={
        trigger || (
          <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive">
            <IconTrash className="size-4" />
          </Button>
        )
      }
      title={`Delete ${itemType}?`}
      description={`Are you sure you want to delete "${itemName}"? This action cannot be undone.`}
      confirmText="Delete"
      variant="destructive"
      onConfirm={onDelete}
      disabled={disabled}
    />
  );
}

/**
 * Pre-configured stop confirmation dialog
 */
export function StopConfirmDialog({
  accountName,
  onStop,
  trigger,
}: {
  accountName: string;
  onStop: () => void | Promise<void>;
  trigger: ReactNode;
}) {
  return (
    <ConfirmDialog
      trigger={trigger}
      title="Stop account?"
      description={`This will disconnect "${accountName}" from Telegram and stop all automation. You can restart it anytime.`}
      confirmText="Stop"
      variant="default"
      onConfirm={onStop}
    />
  );
}

export default ConfirmDialog;
