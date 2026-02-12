import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RegexTestDialog, RegexValidationBadge } from "@/components/RegexTestDialog";
import { HelpTooltip, helpContent } from "@/components/HelpTooltip";
import { RegexHelpDialog } from "@/components/RegexHelpDialog";
import type { PhasePattern } from "@/lib/types";

interface PhasePatternDialogsProps {
  addPatternOpen: boolean;
  editPatternOpen: boolean;
  patternToDelete: PhasePattern | null;
  patternToEdit: PhasePattern | null;
  newPattern: string;
  isRegex: boolean;
  priority: number;
  editPattern: string;
  editIsRegex: boolean;
  editPriority: number;
  onAddPatternChange: (open: boolean) => void;
  onEditPatternChange: (open: boolean) => void;
  onDeletePatternChange: (pattern: PhasePattern | null) => void;
  onUpdateNewPattern: (value: string) => void;
  onUpdateIsRegex: (value: boolean) => void;
  onUpdatePriority: (value: number) => void;
  onUpdateEditPattern: (value: string) => void;
  onUpdateEditIsRegex: (value: boolean) => void;
  onUpdateEditPriority: (value: number) => void;
  onCreatePattern: () => void;
  onUpdatePattern: () => void;
  onDeletePattern: () => void;
}

export function PhasePatternDialogs({
  addPatternOpen,
  editPatternOpen,
  patternToDelete,
  patternToEdit,
  newPattern,
  isRegex,
  priority,
  editPattern,
  editIsRegex,
  editPriority,
  onAddPatternChange,
  onEditPatternChange,
  onDeletePatternChange,
  onUpdateNewPattern,
  onUpdateIsRegex,
  onUpdatePriority,
  onUpdateEditPattern,
  onUpdateEditIsRegex,
  onUpdateEditPriority,
  onCreatePattern,
  onUpdatePattern,
  onDeletePattern,
}: PhasePatternDialogsProps) {
  return (
    <>
      <Dialog open={addPatternOpen} onOpenChange={onAddPatternChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Pattern</DialogTitle>
            <DialogDescription>Add a new detection pattern for this phase.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="pattern">Pattern</Label>
                <RegexValidationBadge pattern={newPattern} isRegex={isRegex} />
              </div>
              <Input
                id="pattern"
                value={newPattern}
                onChange={(e) => onUpdateNewPattern(e.target.value)}
                placeholder="Enter pattern text or regex..."
                className="font-mono"
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RegexTestDialog
                  pattern={newPattern}
                  isRegex={isRegex}
                  trigger={
                    <Button variant="ghost" size="icon-sm" title="Test pattern" aria-label="Test pattern">
                      Test
                    </Button>
                  }
                />
                <HelpTooltip content={helpContent.regex} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1">
                  <Label>Use Regex</Label>
                  <RegexHelpDialog trigger={<Button variant="ghost" size="icon-sm" aria-label="Regex help">?</Button>} />
                </div>
                <p className="text-xs text-muted-foreground">Enable regular expression matching</p>
              </div>
              <Switch checked={isRegex} onCheckedChange={onUpdateIsRegex} />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="priority">Priority</Label>
                <HelpTooltip content={helpContent.phasePriority} />
              </div>
              <Input
                id="priority"
                type="number"
                value={priority}
                onChange={(e) => onUpdatePriority(Number(e.target.value))}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">Lower numbers = higher priority</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onAddPatternChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={onCreatePattern}
              disabled={!newPattern.trim() || (isRegex && (() => { try { new RegExp(newPattern); return false; } catch { return true; } })())}
            >
              Add Pattern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editPatternOpen} onOpenChange={onEditPatternChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pattern</DialogTitle>
            <DialogDescription>Modify the detection pattern settings.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="editPattern">Pattern</Label>
                <RegexValidationBadge pattern={editPattern} isRegex={editIsRegex} />
              </div>
              <Input
                id="editPattern"
                value={editPattern}
                onChange={(e) => onUpdateEditPattern(e.target.value)}
                placeholder="Enter pattern text or regex..."
                className="font-mono"
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RegexTestDialog
                  pattern={editPattern}
                  isRegex={editIsRegex}
                  trigger={
                    <Button variant="ghost" size="icon-sm" title="Test pattern" aria-label="Test pattern">
                      Test
                    </Button>
                  }
                />
                <HelpTooltip content={helpContent.regex} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1">
                  <Label>Use Regex</Label>
                  <RegexHelpDialog trigger={<Button variant="ghost" size="icon-sm" aria-label="Regex help">?</Button>} />
                </div>
                <p className="text-xs text-muted-foreground">Enable regular expression matching</p>
              </div>
              <Switch checked={editIsRegex} onCheckedChange={onUpdateEditIsRegex} />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="editPriority">Priority</Label>
                <HelpTooltip content={helpContent.phasePriority} />
              </div>
              <Input
                id="editPriority"
                type="number"
                value={editPriority}
                onChange={(e) => onUpdateEditPriority(Number(e.target.value))}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">Lower numbers = higher priority</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onEditPatternChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={onUpdatePattern}
              disabled={!editPattern.trim() || (editIsRegex && (() => { try { new RegExp(editPattern); return false; } catch { return true; } })())}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!patternToDelete} onOpenChange={(open) => !open && onDeletePatternChange(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Pattern</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this pattern? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 font-mono text-sm">{patternToDelete?.pattern}</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onDeletePatternChange(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDeletePattern}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
