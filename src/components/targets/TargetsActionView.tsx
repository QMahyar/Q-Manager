import { useMemo } from "react";
import type { Account, Action } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, NoSelection } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/LoadingSkeleton";
import { IconTarget, IconSettings2 } from "@tabler/icons-react";

interface TargetsActionViewProps {
  accounts: Account[];
  actions: Action[];
  actionsLoading: boolean;
  selectedActionId: number | null;
  actionOverrides: Record<number, { hasTargetOverride: boolean; hasDelayOverride: boolean; delayMin?: number; delayMax?: number }>;
  onSelectAction: (id: number) => void;
  onOpenConfig: (accountId: number, accountName: string, action: Action) => void;
}

export function TargetsActionView({
  accounts,
  actions,
  actionsLoading,
  selectedActionId,
  actionOverrides,
  onSelectAction,
  onOpenConfig,
}: TargetsActionViewProps) {
  // useMemo must be called before any early returns (Rules of Hooks)
  const selectedAction = useMemo(
    () => actions.find((action) => action.id === selectedActionId) ?? null,
    [actions, selectedActionId]
  );

  if (actionsLoading) {
    return <ListSkeleton rows={4} />;
  }

  if (actions.length === 0) {
    return (
      <EmptyState
        icon={<IconTarget className="h-8 w-8 text-muted-foreground" />}
        title="No actions yet"
        description="Add actions first to configure targeting rules."
      />
    );
  }

  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={<IconTarget className="h-8 w-8 text-muted-foreground" />}
        title="No accounts yet"
        description="Add accounts first to configure targeting rules."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {actions.map((action) => (
                <div
                  key={action.id}
                  className={`p-3 cursor-pointer transition-colors ${
                    selectedActionId === action.id
                      ? "bg-primary/10 border-l-2 border-l-primary"
                      : "hover:bg-muted/50 border-l-2 border-l-transparent"
                  }`}
                  onClick={() => onSelectAction(action.id)}
                >
                  <div className={`font-medium text-sm ${selectedActionId === action.id ? "text-primary" : ""}`}>
                    {action.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {action.button_type === "player_list"
                      ? "Player List"
                      : action.button_type === "yes_no"
                      ? "Yes/No"
                      : "Fixed Button"}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        {selectedAction ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{selectedAction.name} - Account Targets</CardTitle>
            </CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">No accounts configured yet.</div>
              ) : (
                <div className="rounded-lg border border-border/70 bg-card/70 shadow-sm overflow-hidden">
                  <Table className="min-w-full">
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead>Account</TableHead>
                        <TableHead>Target Rule</TableHead>
                        <TableHead>Delay</TableHead>
                        <TableHead className="text-right pr-4">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts.map((account, index) => {
                        const override = actionOverrides[account.id];
                        return (
                          <TableRow
                            key={account.id}
                            className={index % 2 === 0 ? "hover:bg-muted/20" : "bg-muted/10 hover:bg-muted/25"}
                          >
                            <TableCell className="font-medium">{account.account_name}</TableCell>
                            <TableCell>
                              {override?.hasTargetOverride ? (
                                <Badge className="text-xs bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30 hover:bg-violet-500/20">Custom</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">Default</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {override?.hasDelayOverride ? (
                                <span className="text-sm font-medium">{override.delayMin ?? "?"}–{override.delayMax ?? "?"}s</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Default</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right pr-4">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => onOpenConfig(account.id, account.account_name, selectedAction)}
                                aria-label="Configure targets"
                                className="hover:text-violet-500 hover:bg-violet-500/10"
                              >
                                <IconSettings2 className="size-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <NoSelection itemType="action" />
        )}
      </div>
    </div>
  );
}
