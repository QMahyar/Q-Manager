import { useState } from "react";
import { PageTransition } from "@/components/motion/PageTransition";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { IconCopy, IconHandClick, IconUser } from "@tabler/icons-react";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useTargetsData, useTargetOverrides, useCopyTargets } from "@/hooks/useTargetsData";
import { TargetsAccountView } from "@/components/targets/TargetsAccountView";
import { TargetsActionView } from "@/components/targets/TargetsActionView";
import type { Account, Action } from "@/lib/types";
import { TargetConfigDialog } from "@/components/targets/TargetConfigDialog";
import { TargetsCopyDialogs } from "@/components/targets/TargetsCopyDialogs";
// ============================================================================
// Main Targets Page Component
// ============================================================================

export default function TargetsPage() {
  const [view, setView] = useState<"account" | "action">("account");
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<number | null>(null);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false);
  
  // AutoAnimate for lists
  const [accountsListParent] = useAutoAnimate();
  const [actionsListParent] = useAutoAnimate();
  
  // Target config dialog state
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configAction, setConfigAction] = useState<Action | null>(null);
  const [configAccountId, setConfigAccountId] = useState<number | null>(null);
  const [configAccountName, setConfigAccountName] = useState("");

  const { accountsQuery, actionsQuery } = useTargetsData();
  const accounts = accountsQuery.data ?? [];
  const actions = actionsQuery.data ?? [];
  const accountsLoading = accountsQuery.isLoading;
  const actionsLoading = actionsQuery.isLoading;

  const { actionOverrides, accountOverrides } = useTargetOverrides(
    selectedAccountId,
    selectedActionId,
    accounts,
    actions
  );

  // Copy/Paste state
  const [copiedFromAccount, setCopiedFromAccount] = useState<Account | null>(null);
  const [selectedActionsToCopy, setSelectedActionsToCopy] = useState<Set<number>>(new Set());
  const [selectedAccountsToPaste, setSelectedAccountsToPaste] = useState<Set<number>>(new Set());
  const [pasting, setPasting] = useState(false);

  const handleStartCopy = (account: Account) => {
    setCopiedFromAccount(account);
    setSelectedActionsToCopy(new Set(actions.map((a) => a.id)));
    setCopyDialogOpen(true);
  };

  const handleCopy = () => {
    setCopyDialogOpen(false);
    setSelectedAccountsToPaste(new Set());
    setPasteDialogOpen(true);
  };

  const copyMutation = useCopyTargets();

  const handlePaste = async () => {
    if (!copiedFromAccount) return;
    
    setPasting(true);
    try {
      await copyMutation.mutateAsync({
        fromId: copiedFromAccount.id,
        toIds: [...selectedAccountsToPaste],
        actionIds: [...selectedActionsToCopy],
      });
    } finally {
      setPasting(false);
      setPasteDialogOpen(false);
      setCopiedFromAccount(null);
      setSelectedActionsToCopy(new Set());
      setSelectedAccountsToPaste(new Set());
    }
  };

  const toggleActionToCopy = (actionId: number) => {
    const newSet = new Set(selectedActionsToCopy);
    if (newSet.has(actionId)) {
      newSet.delete(actionId);
    } else {
      newSet.add(actionId);
    }
    setSelectedActionsToCopy(newSet);
  };

  const toggleAccountToPaste = (accountId: number) => {
    const newSet = new Set(selectedAccountsToPaste);
    if (newSet.has(accountId)) {
      newSet.delete(accountId);
    } else {
      newSet.add(accountId);
    }
    setSelectedAccountsToPaste(newSet);
  };

  const openConfigDialog = (accountId: number, accountName: string, action: Action) => {
    setConfigAccountId(accountId);
    setConfigAccountName(accountName);
    setConfigAction(action);
    setConfigDialogOpen(true);
  };

  return (
    <PageTransition className="min-h-screen flex flex-col">
      <PageHeader
        title="Targets"
        description="Set per-account targeting rules for actions"
      />

      <main className="flex-1 p-6 w-full max-w-6xl mx-auto">
        <Tabs value={view} onValueChange={(v) => setView(v as "account" | "action")}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="account">
                <IconUser className="size-4 mr-1" />
                Account-First
              </TabsTrigger>
              <TabsTrigger value="action">
                <IconHandClick className="size-4 mr-1" />
                Action-First
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Account-First View */}
          <TabsContent value="account">
            <TargetsAccountView
              accounts={accounts}
              actions={actions}
              accountsLoading={accountsLoading}
              selectedAccountId={selectedAccountId}
              accountOverrides={accountOverrides}
              onSelectAccount={setSelectedAccountId}
              onOpenConfig={openConfigDialog}
              onStartCopy={handleStartCopy}
              accountsListRef={accountsListParent}
              actionsListRef={actionsListParent}
            />
          </TabsContent>

          {/* Action-First View */}
          <TabsContent value="action">
            <TargetsActionView
              accounts={accounts}
              actions={actions}
              actionsLoading={actionsLoading}
              selectedActionId={selectedActionId}
              actionOverrides={actionOverrides}
              onSelectAction={setSelectedActionId}
              onOpenConfig={openConfigDialog}
            />
          </TabsContent>
        </Tabs>

        <TargetsCopyDialogs
          actions={actions}
          accounts={accounts}
          copyDialogOpen={copyDialogOpen}
          pasteDialogOpen={pasteDialogOpen}
          copiedFromAccount={copiedFromAccount}
          selectedActionsToCopy={selectedActionsToCopy}
          selectedAccountsToPaste={selectedAccountsToPaste}
          pasting={pasting}
          onCopyDialogOpenChange={setCopyDialogOpen}
          onPasteDialogOpenChange={setPasteDialogOpen}
          onToggleActionToCopy={toggleActionToCopy}
          onToggleAccountToPaste={toggleAccountToPaste}
          onCopy={handleCopy}
          onPaste={handlePaste}
        />

        {/* Target Configuration Dialog */}
        {configAction && configAccountId && (
          <TargetConfigDialog
            open={configDialogOpen}
            onOpenChange={setConfigDialogOpen}
            accountId={configAccountId}
            action={configAction}
            accountName={configAccountName}
          />
        )}
      </main>
    </PageTransition>
  );
}
