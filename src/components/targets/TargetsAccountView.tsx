import { useMemo } from "react";
import type { Account, Action } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, NoSelection } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/LoadingSkeleton";
import { IconCopy, IconHeart, IconTarget, IconSettings2 } from "@tabler/icons-react";

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
  // useMemo must be called before any early returns (Rules of Hooks)
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  );

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

  if (actions.length === 0) {
    return (
      <EmptyState
        icon={<IconTarget className="h-8 w-8 text-muted-foreground" />}
        title="No actions yet"
        description="Create actions to start setting targeting rules."
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
                  className={`p-3 cursor-pointer flex items-center justify-between transition-colors ${
                    selectedAccountId === account.id
                      ? "bg-primary/10 border-l-2 border-l-primary"
                      : "hover:bg-muted/50 border-l-2 border-l-transparent"
                  }`}
                  onClick={() => onSelectAccount(account.id)}
                >
                  <div>
                    <div className={`font-medium text-sm ${selectedAccountId === account.id ? "text-primary" : ""}`}>
                      {account.account_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
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
                    className="hover:text-sky-500 hover:bg-sky-500/10"
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
        {selectedAccount ? (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">Targets for {selectedAccount.account_name}</CardTitle>
                <Button variant="outline" size="sm" onClick={() => onStartCopy(selectedAccount)}>
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
                  {actions.map((action) => {
                    const hasOverride = accountOverrides[action.id]?.hasTargetOverride || accountOverrides[action.id]?.hasDelayOverride;
                    return (
                      <div
                        key={action.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div>
                          <div className="font-medium text-sm">{action.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {hasOverride ? (
                              <Badge variant="default" className="text-xs h-4 px-1.5 bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30 hover:bg-violet-500/20">
                                Custom
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Default</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {action.button_type === "player_list"
                              ? "Player List"
                              : action.button_type === "yes_no"
                              ? "Yes/No"
                              : "Fixed"}
                          </Badge>
                          {action.is_two_step && (
                            <Badge variant="outline" className="text-xs text-pink-500 border-pink-500/50">
                              <IconHeart className="size-3 mr-1" />
                              Two-Step
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onOpenConfig(selectedAccount.id, selectedAccount.account_name, action)}
                            aria-label="Configure targets"
                            className="hover:text-violet-500 hover:bg-violet-500/10"
                          >
                            <IconSettings2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
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
