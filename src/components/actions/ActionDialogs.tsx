import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RegexTestDialog, RegexValidationBadge } from "@/components/RegexTestDialog";
import { HelpTooltip, helpContent } from "@/components/HelpTooltip";
import { validateDisplayName } from "@/lib/validation";
import { toastError } from "@/lib/toast-utils";
import type { Action, ActionCreate, ActionPattern, ActionUpdate, ButtonType } from "@/lib/types";
import { IconFlask, IconTrash, IconAlertTriangle } from "@tabler/icons-react";

interface ActionDialogsProps {
  addActionOpen: boolean;
  editActionOpen: boolean;
  deleteActionOpen: boolean;
  addPatternOpen: boolean;
  editPatternOpen: boolean;
  actionToEdit: Action | null;
  actionToDelete: Action | null;
  patternToEdit: ActionPattern | null;
  newActionName: string;
  newButtonType: ButtonType;
  newRandomFallback: boolean;
  newIsTwoStep: boolean;
  newPattern: string;
  newPatternIsRegex: boolean;
  newPatternPriority: number;
  editPatternText: string;
  editPatternIsRegex: boolean;
  editPatternPriority: number;
  onAddActionChange: (open: boolean) => void;
  onEditActionChange: (open: boolean) => void;
  onDeleteActionChange: (open: boolean) => void;
  onAddPatternChange: (open: boolean) => void;
  onEditPatternChange: (open: boolean) => void;
  onUpdateNewActionName: (value: string) => void;
  onUpdateNewButtonType: (value: ButtonType) => void;
  onUpdateNewRandomFallback: (value: boolean) => void;
  onUpdateNewIsTwoStep: (value: boolean) => void;
  onUpdateNewPattern: (value: string) => void;
  onUpdateNewPatternIsRegex: (value: boolean) => void;
  onUpdateNewPatternPriority: (value: number) => void;
  onUpdateEditPatternText: (value: string) => void;
  onUpdateEditPatternIsRegex: (value: boolean) => void;
  onUpdateEditPatternPriority: (value: number) => void;
  onCreateAction: (payload: ActionCreate) => void;
  onUpdateAction: (payload: ActionUpdate) => void;
  onDeleteAction: () => void;
  onCreatePattern: () => void;
  onUpdatePattern: () => void;
}

export function ActionDialogs({
  addActionOpen,
  editActionOpen,
  deleteActionOpen,
  addPatternOpen,
  editPatternOpen,
  actionToEdit,
  actionToDelete,
  patternToEdit,
  newActionName,
  newButtonType,
  newRandomFallback,
  newIsTwoStep,
  newPattern,
  newPatternIsRegex,
  newPatternPriority,
  editPatternText,
  editPatternIsRegex,
  editPatternPriority,
  onAddActionChange,
  onEditActionChange,
  onDeleteActionChange,
  onAddPatternChange,
  onEditPatternChange,
  onUpdateNewActionName,
  onUpdateNewButtonType,
  onUpdateNewRandomFallback,
  onUpdateNewIsTwoStep,
  onUpdateNewPattern,
  onUpdateNewPatternIsRegex,
  onUpdateNewPatternPriority,
  onUpdateEditPatternText,
  onUpdateEditPatternIsRegex,
  onUpdateEditPatternPriority,
  onCreateAction,
  onUpdateAction,
  onDeleteAction,
  onCreatePattern,
  onUpdatePattern,
}: ActionDialogsProps) {
  const [addNameError, setAddNameError] = useState<string | undefined>();
  const [editNameError, setEditNameError] = useState<string | undefined>();

  const handleCreateAction = () => {
    const validation = validateDisplayName(newActionName);
    if (!validation.valid) {
      setAddNameError(validation.error);
      toastError("Invalid name", validation.error);
      return;
    }
    setAddNameError(undefined);
    onCreateAction({
      name: newActionName.trim(),
      button_type: newButtonType,
      random_fallback_enabled: newRandomFallback,
      is_two_step: newIsTwoStep,
    });
  };

  const handleUpdateAction = () => {
    if (!actionToEdit) return;
    const validation = validateDisplayName(newActionName);
    if (!validation.valid) {
      setEditNameError(validation.error);
      toastError("Invalid name", validation.error);
      return;
    }
    setEditNameError(undefined);
    onUpdateAction({
      id: actionToEdit.id,
      name: newActionName.trim(),
      button_type: newButtonType,
      random_fallback_enabled: newRandomFallback,
      is_two_step: newIsTwoStep,
    });
  };

  return (
    <>
      <Dialog open={addActionOpen} onOpenChange={(open) => { if (!open) setAddNameError(undefined); onAddActionChange(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Action</DialogTitle>
            <DialogDescription>Create a new action definition with trigger patterns.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="action-name">Name</Label>
              <Input
                id="action-name"
                value={newActionName}
                onChange={(e) => {
                  onUpdateNewActionName(e.target.value);
                  const result = validateDisplayName(e.target.value);
                  setAddNameError(result.error);
                }}
                placeholder="e.g., Vote, Shoot, Heal"
                className={addNameError ? "border-destructive" : ""}
              />
              {addNameError && <p className="text-xs text-destructive">{addNameError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="button-type">Button Type</Label>
              <Select value={newButtonType} onValueChange={(v) => onUpdateNewButtonType(v as ButtonType)}>
                <SelectTrigger id="button-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="player_list">Player List</SelectItem>
                  <SelectItem value="yes_no">Yes / No</SelectItem>
                  <SelectItem value="fixed">Fixed Button</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div>
                <Label htmlFor="random-fallback" className="cursor-pointer">Random Fallback</Label>
                <p className="text-xs text-muted-foreground">Pick random target if none from list are available</p>
              </div>
              <Switch id="random-fallback" checked={newRandomFallback} onCheckedChange={onUpdateNewRandomFallback} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div>
                <Label htmlFor="two-step" className="cursor-pointer">Two-step action</Label>
                <p className="text-xs text-muted-foreground">Requires two sequential prompts (e.g., Cupid)</p>
              </div>
              <Switch id="two-step" checked={newIsTwoStep} onCheckedChange={onUpdateNewIsTwoStep} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onAddActionChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAction}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editActionOpen} onOpenChange={(open) => { if (!open) setEditNameError(undefined); onEditActionChange(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Action</DialogTitle>
            <DialogDescription>Update the action definition.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-action-name">Name</Label>
              <Input
                id="edit-action-name"
                value={newActionName}
                onChange={(e) => {
                  onUpdateNewActionName(e.target.value);
                  const result = validateDisplayName(e.target.value);
                  setEditNameError(result.error);
                }}
                placeholder="e.g., Vote, Shoot, Heal"
                className={editNameError ? "border-destructive" : ""}
              />
              {editNameError && <p className="text-xs text-destructive">{editNameError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-button-type">Button Type</Label>
              <Select value={newButtonType} onValueChange={(v) => onUpdateNewButtonType(v as ButtonType)}>
                <SelectTrigger id="edit-button-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="player_list">Player List</SelectItem>
                  <SelectItem value="yes_no">Yes / No</SelectItem>
                  <SelectItem value="fixed">Fixed Button</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div>
                <Label htmlFor="edit-random-fallback" className="cursor-pointer">Random Fallback</Label>
                <p className="text-xs text-muted-foreground">Pick random target if none from list are available</p>
              </div>
              <Switch
                id="edit-random-fallback"
                checked={newRandomFallback}
                onCheckedChange={onUpdateNewRandomFallback}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div>
                <Label htmlFor="edit-two-step" className="cursor-pointer">Two-step action</Label>
                <p className="text-xs text-muted-foreground">Requires two sequential prompts (e.g., Cupid)</p>
              </div>
              <Switch id="edit-two-step" checked={newIsTwoStep} onCheckedChange={onUpdateNewIsTwoStep} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onEditActionChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateAction}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteActionOpen} onOpenChange={onDeleteActionChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Action</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="flex items-start gap-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <IconAlertTriangle className="size-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">
                Deleting <strong>{actionToDelete?.name}</strong> will also remove all associated patterns and target rules.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onDeleteActionChange(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => actionToDelete && onDeleteAction()}>
              <IconTrash className="size-4 mr-1.5" />
              Delete Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addPatternOpen} onOpenChange={onAddPatternChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Pattern</DialogTitle>
            <DialogDescription>Add a new trigger pattern for this action.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="pattern">Pattern</Label>
                <RegexValidationBadge pattern={newPattern} isRegex={newPatternIsRegex} />
              </div>
              <Input
                id="pattern"
                value={newPattern}
                onChange={(e) => onUpdateNewPattern(e.target.value)}
                placeholder="Enter pattern text or regex..."
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RegexTestDialog
                  pattern={newPattern}
                  isRegex={newPatternIsRegex}
                  trigger={
                    <Button variant="ghost" size="icon-sm" title="Test pattern" aria-label="Test pattern">
                      <IconFlask className="size-4" />
                    </Button>
                  }
                />
                <HelpTooltip content={helpContent.regex} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="pattern-regex">Use regex</Label>
                <p className="text-xs text-muted-foreground">Enable regex matching for this pattern.</p>
              </div>
              <Switch id="pattern-regex" checked={newPatternIsRegex} onCheckedChange={onUpdateNewPatternIsRegex} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pattern-priority">Priority</Label>
              <Input
                id="pattern-priority"
                type="number"
                value={newPatternPriority}
                onChange={(e) => onUpdateNewPatternPriority(Number(e.target.value))}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onAddPatternChange(false)}>
              Cancel
            </Button>
            <Button onClick={onCreatePattern}>Add Pattern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editPatternOpen} onOpenChange={onEditPatternChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pattern</DialogTitle>
            <DialogDescription>Modify the trigger pattern settings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-pattern">Pattern</Label>
                <RegexValidationBadge pattern={editPatternText} isRegex={editPatternIsRegex} />
              </div>
              <Input
                id="edit-pattern"
                value={editPatternText}
                onChange={(e) => onUpdateEditPatternText(e.target.value)}
                placeholder="Enter pattern text or regex..."
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RegexTestDialog
                  pattern={editPatternText}
                  isRegex={editPatternIsRegex}
                  trigger={
                    <Button variant="ghost" size="icon-sm" title="Test pattern" aria-label="Test pattern">
                      <IconFlask className="size-4" />
                    </Button>
                  }
                />
                <HelpTooltip content={helpContent.regex} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="edit-pattern-regex">Use regex</Label>
                <p className="text-xs text-muted-foreground">Enable regex matching for this pattern.</p>
              </div>
              <Switch
                id="edit-pattern-regex"
                checked={editPatternIsRegex}
                onCheckedChange={onUpdateEditPatternIsRegex}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-pattern-priority">Priority</Label>
              <Input
                id="edit-pattern-priority"
                type="number"
                value={editPatternPriority}
                onChange={(e) => onUpdateEditPatternPriority(Number(e.target.value))}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onEditPatternChange(false)}>
              Cancel
            </Button>
            <Button onClick={onUpdatePattern} disabled={!patternToEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
