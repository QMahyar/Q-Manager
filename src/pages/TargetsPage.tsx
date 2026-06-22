import { useState } from "react";
import { PageTransition } from "@/components/motion/PageTransition";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { IconTarget } from "@tabler/icons-react";
import { PageHeader } from "@/components/page-header";
import { useTargetsData, useTargetOverrides, useCopyTargets } from "@/hooks/useTargetsData";
import type { Account, Action } from "@/lib/types";
import { TargetConfigDialog } from "@/components/targets/TargetConfigDialog";
import { TargetsCopyDialogs } from "@/components/targets/TargetsCopyDialogs";
import { TargetsView } from "@/components/targets/TargetsView";
import { EmptyState } from "@/components/EmptyState";
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
  const targetsError = accountsQuery.isError || actionsQuery.isError;

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
        icon={IconTarget}
        iconColor="text-orange-500"
      />

      <main className="flex-1 p-6 w-full max-w-6xl mx-auto">
        {targetsError ? (
          <EmptyState
            icon={<IconTarget className="h-8 w-8 text-muted-foreground" />}
            title="Unable to load targets"
            description="Check your connection or try again."
          />
        ) : (
          <TargetsView
            view={view}
            accounts={accounts}
            actions={actions}
            accountsLoading={accountsLoading}
            actionsLoading={actionsLoading}
            selectedAccountId={selectedAccountId}
            selectedActionId={selectedActionId}
            accountOverrides={accountOverrides}
            actionOverrides={actionOverrides}
            onViewChange={setView}
            onSelectAccount={setSelectedAccountId}
            onSelectAction={setSelectedActionId}
            onOpenConfig={openConfigDialog}
            onStartCopy={handleStartCopy}
            accountsListRef={accountsListParent}
            actionsListRef={actionsListParent}
          />
        )}

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
