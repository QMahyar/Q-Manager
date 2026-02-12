import type { Account, Action } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, NoSelection } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/LoadingSkeleton";
import { IconCopy, IconHeart, IconTarget } from "@tabler/icons-react";

interface TargetsAccountViewProps {
  accounts: Account[];
  actions: Action[];
  accountsLoading: boolean;
  selectedAccountId: number | null;
  accountOverrides: Record<number, { hasTargetOverride: boolean; hasDelayOverride: boolean }>;
  onSelectAccount: (id: number) => void;
  onOpenConfig: (accountId: number, accountName: string, action: Action) => void;
  onStartCopy: (account: Account) => void;
  accountsListRef?: React.Ref<HTMLDivElement>;
  actionsListRef?: React.Ref<HTMLDivElement>;
}

export function TargetsAccountView({
  accounts,
  actions,
  accountsLoading,
  selectedAccountId,
  accountOverrides,
  onSelectAccount,
  onOpenConfig,
  onStartCopy,
  accountsListRef,
  actionsListRef,
}: TargetsAccountViewProps) {
  if (accountsLoading) {
    return <ListSkeleton rows={4} />;
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
            <CardTitle className="text-base">Accounts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y" ref={accountsListRef}>
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className={`p-3 cursor-pointer hover:bg-muted/50 flex items-center justify-between ${
                    selectedAccountId === account.id ? "bg-muted" : ""
                  }`}
                  onClick={() => onSelectAccount(account.id)}
                >
                  <div>
                    <div className="font-medium">{account.account_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {account.phone || "No phone"}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartCopy(account);
                    }}
                    aria-label="Copy targets from account"
                  >
                    <IconCopy className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        {selectedAccountId ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Targets for {accounts.find((a) => a.id === selectedAccountId)?.account_name}
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStartCopy(accounts.find((a) => a.id === selectedAccountId)!)}
                >
                  <IconCopy className="size-4 mr-1" />
                  Copy Targets
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {actions.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">No actions configured yet.</div>
              ) : (
                <div className="space-y-3" ref={actionsListRef}>
                  {actions.map((action) => (
                    <div
                      key={action.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <div>
                        <div className="font-medium">{action.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {accountOverrides[action.id]?.hasTargetOverride || accountOverrides[action.id]?.hasDelayOverride
                            ? "Using custom overrides"
                            : "Using global defaults"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {action.button_type === "player_list"
                            ? "Player List"
                            : action.button_type === "yes_no"
                            ? "Yes/No"
                            : "Fixed"}
                        </Badge>
                        {action.is_two_step && (
                          <Badge variant="outline" className="text-pink-500 border-pink-500">
                            <IconHeart className="size-3 mr-1" />
                            Two-Step
                          </Badge>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            onOpenConfig(
                              selectedAccountId,
                              accounts.find((a) => a.id === selectedAccountId)?.account_name || "",
                              action
                            )
                          }
                        >
                          Configure
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <NoSelection itemType="account" />
        )}
      </div>
    </div>
  );
}
