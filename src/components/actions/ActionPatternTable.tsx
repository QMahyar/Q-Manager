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
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-medium">{stepLabel || "Trigger Patterns"}</h5>
        <Button size="sm" variant="outline" onClick={() => onAddPattern(action.id, resolvedStep)}>
          <IconPlus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>
      {patterns.length === 0 ? (
        <p className="text-sm text-muted-foreground bg-muted/50 rounded p-3">No patterns configured yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pattern</TableHead>
              <TableHead className="w-20">Type</TableHead>
              <TableHead className="w-20">Priority</TableHead>
              <TableHead className="w-20">Enabled</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody ref={tableRef}>
            {[...patterns].sort((a, b) => b.priority - a.priority).map((pattern) => (
              <TableRow key={pattern.id}>
                <TableCell className="font-mono text-sm">{pattern.pattern}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
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
                <TableCell>
                  <div className="flex items-center gap-1">
                    <RegexTestDialog
                      pattern={pattern.pattern}
                      isRegex={pattern.is_regex}
                      trigger={
                        <Button variant="ghost" size="icon-sm" title="Test pattern" aria-label="Test pattern">
                          <IconFlask className="size-4" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Edit Pattern"
                      aria-label="Edit pattern"
                      onClick={() => onEditPattern(pattern)}
                    >
                      <IconPencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Delete Pattern"
                      aria-label="Delete pattern"
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
      )}
    </div>
  );
}
