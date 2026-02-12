import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import type { Action } from "@/lib/types";
import { IconPlus } from "@tabler/icons-react";

interface ActionDefaultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: Action | undefined;
  defaultsActionName: string;
  defaultFixedText: string;
  defaultTargets: string[];
  defaultRandomFallback: boolean;
  defaultDelayMin: number;
  defaultDelayMax: number;
  newTargetInput: string;
  onUpdateFixedText: (value: string) => void;
  onUpdateTargets: (targets: string[]) => void;
  onUpdateRandomFallback: (value: boolean) => void;
  onUpdateDelayMin: (value: number) => void;
  onUpdateDelayMax: (value: number) => void;
  onUpdateNewTargetInput: (value: string) => void;
  onAddTarget: () => void;
  onRemoveTarget: (target: string) => void;
  onSave: () => void;
}

export function ActionDefaultsDialog({
  open,
  onOpenChange,
  action,
  defaultsActionName,
  defaultFixedText,
  defaultTargets,
  defaultRandomFallback,
  defaultDelayMin,
  defaultDelayMax,
  newTargetInput,
  onUpdateFixedText,
  onUpdateTargets,
  onUpdateRandomFallback,
  onUpdateDelayMin,
  onUpdateDelayMax,
  onUpdateNewTargetInput,
  onAddTarget,
  onRemoveTarget,
  onSave,
}: ActionDefaultsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Defaults</DialogTitle>
          <DialogDescription>
            Set global default targets and delays for "{defaultsActionName}".
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {action?.button_type === "player_list" ? (
            <>
              <div className="grid gap-2">
                <Label>Default Targets (priority order)</Label>
                <div className="flex gap-2">
                  <Input
                    value={newTargetInput}
                    onChange={(e) => onUpdateNewTargetInput(e.target.value)}
                    placeholder="Add target name..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onAddTarget();
                      }
                    }}
                  />
                  <Button type="button" onClick={onAddTarget} disabled={!newTargetInput.trim()}>
                    <IconPlus className="size-4" />
                  </Button>
                </div>
                {defaultTargets.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {defaultTargets.map((target, idx) => (
                      <Badge key={idx} variant="secondary" className="gap-1">
                        {target}
                        <button
                          type="button"
                          onClick={() => onRemoveTarget(target)}
                          className="ml-1 hover:text-destructive"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Players will be targeted in this order</p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Random Fallback</Label>
                  <p className="text-xs text-muted-foreground">Pick random if no target matches</p>
                </div>
                <Switch checked={defaultRandomFallback} onCheckedChange={onUpdateRandomFallback} />
              </div>
            </>
          ) : (
            <div className="grid gap-2">
              <Label>Default Button Text</Label>
              <Input
                value={defaultFixedText}
                onChange={(e) => onUpdateFixedText(e.target.value)}
                placeholder="Enter exact button text..."
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Enter the exact button text to click for this action.
              </p>
            </div>
          )}

          <div className="grid gap-2">
            <Label>Default Delay (seconds)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Min</Label>
                <Input
                  type="number"
                  min={0}
                  value={defaultDelayMin}
                  onChange={(e) => onUpdateDelayMin(Number(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Max</Label>
                <Input
                  type="number"
                  min={0}
                  value={defaultDelayMax}
                  onChange={(e) => onUpdateDelayMax(Number(e.target.value))}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Random delay between min and max before clicking</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave}>Save Defaults</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
