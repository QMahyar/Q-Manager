import type { Action, ActionPattern } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RegexTestDialog, RegexValidationBadge } from "@/components/RegexTestDialog";
import { IconFlask, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";

interface ActionPatternTableProps {
  action: Action;
  patterns: ActionPattern[];
  stepLabel?: string;
  tableRef?: React.Ref<HTMLTableSectionElement>;
  onAddPattern: (actionId: number, step: number) => void;
  onTogglePattern: (pattern: ActionPattern, enabled: boolean) => void;
  onEditPattern: (pattern: ActionPattern) => void;
  onDeletePattern: (patternId: number) => void;
}

export function ActionPatternTable({
  action,
  patterns,
  stepLabel,
  tableRef,
  onAddPattern,
  onTogglePattern,
  onEditPattern,
  onDeletePattern,
}: ActionPatternTableProps) {
  const resolvedStep = stepLabel === "Trigger A (First Prompt)" ? 1 : stepLabel === "Trigger B (Second Prompt)" ? 2 : 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h5 className="text-sm font-medium">{stepLabel || "Trigger Patterns"}</h5>
        <Button size="sm" variant="outline" onClick={() => onAddPattern(action.id, resolvedStep)}>
          <IconPlus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>
      {patterns.length === 0 ? (
        <p className="text-sm text-muted-foreground bg-muted/50 rounded p-3">No patterns configured yet.</p>
      ) : (
        <div className="rounded-lg border border-border/70 bg-card/70 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>Pattern</TableHead>
                <TableHead className="w-20">Type</TableHead>
                <TableHead className="w-20">Priority</TableHead>
                <TableHead className="w-20">Enabled</TableHead>
                <TableHead className="w-16 text-right pr-4"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody ref={tableRef}>
              {[...patterns].sort((a, b) => b.priority - a.priority).map((pattern, index) => (
                <TableRow
                  key={pattern.id}
                  className={index % 2 === 0 ? "hover:bg-muted/20" : "bg-muted/10 hover:bg-muted/25"}
                >
                  <TableCell className="font-mono text-sm">{pattern.pattern}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={pattern.is_regex ? "default" : "secondary"} className="text-xs">
                        {pattern.is_regex ? "Regex" : "Text"}
                      </Badge>
                      <RegexValidationBadge pattern={pattern.pattern} isRegex={pattern.is_regex} />
                    </div>
                  </TableCell>
                  <TableCell>{pattern.priority}</TableCell>
                  <TableCell>
                    <Switch
                      checked={pattern.enabled}
                      onCheckedChange={(enabled) => onTogglePattern(pattern, enabled)}
                    />
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <RegexTestDialog
                        pattern={pattern.pattern}
                        isRegex={pattern.is_regex}
                        trigger={
                          <Button variant="ghost" size="icon-sm" title="Test pattern" aria-label="Test pattern" className="hover:text-violet-500 hover:bg-violet-500/10">
                            <IconFlask className="size-4" />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Edit Pattern"
                        aria-label="Edit pattern"
                        className="hover:text-sky-500 hover:bg-sky-500/10"
                        onClick={() => onEditPattern(pattern)}
                      >
                        <IconPencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Delete Pattern"
                        aria-label="Delete pattern"
                        className="hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onDeletePattern(pattern.id)}
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
