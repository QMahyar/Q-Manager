import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { IconClipboard, IconCopy, IconAlertTriangle } from "@tabler/icons-react";
import type { Account, Action } from "@/lib/types";

interface TargetsCopyDialogsProps {
  actions: Action[];
  accounts: Account[];
  copyDialogOpen: boolean;
  pasteDialogOpen: boolean;
  copiedFromAccount: Account | null;
  selectedActionsToCopy: Set<number>;
  selectedAccountsToPaste: Set<number>;
  pasting: boolean;
  onCopyDialogOpenChange: (open: boolean) => void;
  onPasteDialogOpenChange: (open: boolean) => void;
  onToggleActionToCopy: (actionId: number) => void;
  onToggleAccountToPaste: (accountId: number) => void;
  onCopy: () => void;
  onPaste: () => void;
}

export function TargetsCopyDialogs({
  actions,
  accounts,
  copyDialogOpen,
  pasteDialogOpen,
  copiedFromAccount,
  selectedActionsToCopy,
  selectedAccountsToPaste,
  pasting,
  onCopyDialogOpenChange,
  onPasteDialogOpenChange,
  onToggleActionToCopy,
  onToggleAccountToPaste,
  onCopy,
  onPaste,
}: TargetsCopyDialogsProps) {
  return (
    <>
      <Dialog open={copyDialogOpen} onOpenChange={onCopyDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy Targets</DialogTitle>
            <DialogDescription>
              Select which action targets to copy from "{copiedFromAccount?.account_name}".
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 max-h-64 overflow-y-auto space-y-1">
            {actions.map((action) => (
              <div
                key={action.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                  selectedActionsToCopy.has(action.id)
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-muted/50 border border-transparent"
                }`}
                onClick={() => onToggleActionToCopy(action.id)}
              >
                <Checkbox
                  checked={selectedActionsToCopy.has(action.id)}
                  onCheckedChange={() => onToggleActionToCopy(action.id)}
                />
                <span className="text-sm font-medium">{action.name}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onCopyDialogOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onCopy} disabled={selectedActionsToCopy.size === 0}>
              <IconCopy className="size-4 mr-1.5" />
              Copy {selectedActionsToCopy.size > 0 ? `(${selectedActionsToCopy.size})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pasteDialogOpen} onOpenChange={onPasteDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paste Targets</DialogTitle>
            <DialogDescription>
              Select accounts to paste targets to. This will overwrite existing targets.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              <IconAlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-600 dark:text-amber-400">
                This will overwrite existing target settings on selected accounts.
              </p>
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1">
              {accounts
                .filter((a) => a.id !== copiedFromAccount?.id)
                .map((account) => (
                  <div
                    key={account.id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                      selectedAccountsToPaste.has(account.id)
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted/50 border border-transparent"
                    }`}
                    onClick={() => onToggleAccountToPaste(account.id)}
                  >
                    <Checkbox
                      checked={selectedAccountsToPaste.has(account.id)}
                      onCheckedChange={() => onToggleAccountToPaste(account.id)}
                    />
                    <span className="text-sm font-medium">{account.account_name}</span>
                  </div>
                ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onPasteDialogOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onPaste} disabled={selectedAccountsToPaste.size === 0 || pasting}>
              <IconClipboard className="size-4 mr-1.5" />
              {pasting ? "Pasting..." : `Paste to ${selectedAccountsToPaste.size > 0 ? `${selectedAccountsToPaste.size} ` : ""}accounts`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
