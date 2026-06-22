import type { Ref } from "react";
import type { Account, Action } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TargetsAccountView } from "@/components/targets/TargetsAccountView";
import { TargetsActionView } from "@/components/targets/TargetsActionView";
import { IconHandClick, IconUser } from "@tabler/icons-react";

interface TargetsViewProps {
  view: "account" | "action";
  accounts: Account[];
  actions: Action[];
  accountsLoading: boolean;
  actionsLoading: boolean;
  selectedAccountId: number | null;
  selectedActionId: number | null;
  accountOverrides: Record<number, { hasTargetOverride: boolean; hasDelayOverride: boolean }>;
  actionOverrides: Record<number, { hasTargetOverride: boolean; hasDelayOverride: boolean; delayMin?: number; delayMax?: number }>;
  onViewChange: (view: "account" | "action") => void;
  onSelectAccount: (id: number) => void;
  onSelectAction: (id: number) => void;
  onOpenConfig: (accountId: number, accountName: string, action: Action) => void;
  onStartCopy: (account: Account) => void;
  accountsListRef?: Ref<HTMLDivElement>;
  actionsListRef?: Ref<HTMLDivElement>;
}

export function TargetsView({
  view,
  accounts,
  actions,
  accountsLoading,
  actionsLoading,
  selectedAccountId,
  selectedActionId,
  accountOverrides,
  actionOverrides,
  onViewChange,
  onSelectAccount,
  onSelectAction,
  onOpenConfig,
  onStartCopy,
  accountsListRef,
  actionsListRef,
}: TargetsViewProps) {
  return (
    <Tabs value={view} onValueChange={(value) => onViewChange(value as "account" | "action")}>
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1">
          <TabsList className="flex-wrap">
            <TabsTrigger value="account" className="flex items-center gap-1.5">
              <IconUser className="size-3.5" />
              Account-First
            </TabsTrigger>
            <TabsTrigger value="action" className="flex items-center gap-1.5">
              <IconHandClick className="size-3.5" />
              Action-First
            </TabsTrigger>
          </TabsList>
          <p className="text-xs text-muted-foreground pl-1">
            {view === "account"
              ? "Select an account, then configure targeting per action"
              : "Select an action, then configure targeting per account"}
          </p>
        </div>
      </div>

      <TabsContent value="account">
        <TargetsAccountView
          accounts={accounts}
          actions={actions}
          accountsLoading={accountsLoading}
          selectedAccountId={selectedAccountId}
          accountOverrides={accountOverrides}
          onSelectAccount={onSelectAccount}
          onOpenConfig={onOpenConfig}
          onStartCopy={onStartCopy}
          accountsListRef={accountsListRef}
          actionsListRef={actionsListRef}
        />
      </TabsContent>

      <TabsContent value="action">
        <TargetsActionView
          accounts={accounts}
          actions={actions}
          actionsLoading={actionsLoading}
          selectedActionId={selectedActionId}
          actionOverrides={actionOverrides}
          onSelectAction={onSelectAction}
          onOpenConfig={onOpenConfig}
        />
      </TabsContent>
    </Tabs>
  );
}
