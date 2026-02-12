import type { Account, Action } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, NoSelection } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/LoadingSkeleton";
import { IconTarget } from "@tabler/icons-react";

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
                  className={`p-3 cursor-pointer hover:bg-muted/50 ${
                    selectedActionId === action.id ? "bg-muted" : ""
                  }`}
                  onClick={() => onSelectAction(action.id)}
                >
                  <div className="font-medium">{action.name}</div>
                  <div className="text-sm text-muted-foreground">
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
        {selectedActionId ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {actions.find((a) => a.id === selectedActionId)?.name} - Account Targets
              </CardTitle>
            </CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">No accounts configured yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Target Rule</TableHead>
                      <TableHead>Delay</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((account) => {
                      const override = actionOverrides[account.id];
                      return (
                        <TableRow key={account.id}>
                          <TableCell className="font-medium">{account.account_name}</TableCell>
                          <TableCell>
                            {override?.hasTargetOverride ? (
                              <Badge variant="default">Custom</Badge>
                            ) : (
                              <span className="text-muted-foreground">Default</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {override?.hasDelayOverride ? (
                              <span className="font-medium">{override.delayMin}-{override.delayMax}s</span>
                            ) : (
                              <span className="text-muted-foreground">Default</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const action = actions.find((a) => a.id === selectedActionId);
                                if (action) {
                                  onOpenConfig(account.id, account.account_name, action);
                                }
                              }}
                            >
                              Configure
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
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
