import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageTransition } from "@/components/motion/PageTransition";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import {
  IconCopy,
  IconClipboard,
  IconUser,
  IconHandClick,
  IconPlus,
  IconTrash,
  IconClock,
  IconBan,
  IconHeart,
  IconSettings,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  getTargetOverride,
  setTargetOverride,
  deleteTargetOverride,
  getDelayOverride,
  setDelayOverride,
  deleteDelayOverride,
  listBlacklist,
  addBlacklistEntry,
  removeBlacklistEntry,
  listTargetPairs,
  addTargetPair,
  removeTargetPair,
} from "@/lib/api";
import {
  useTargetsData,
  useTargetOverrides,
  useCopyTargets,
} from "@/hooks/useTargetsData";
import type { Account, Action, TargetBlacklist, TargetPair, TargetRule } from "@/lib/types";
import { ListSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState, NoSelection } from "@/components/EmptyState";
import { IconTarget } from "@tabler/icons-react";
import { validateDelay } from "@/lib/validation";
import { toast } from "@/components/ui/sonner";
import { getErrorMessage } from "@/lib/error-utils";
// ============================================================================
// Target Configuration Dialog Component
// ============================================================================

interface TargetConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: number;
  action: Action;
  accountName: string;
}

function TargetConfigDialog({ open, onOpenChange, accountId, action, accountName }: TargetConfigDialogProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"targets" | "delay" | "blacklist" | "pairs">("targets");
  
  // Target rule state
  const [targets, setTargets] = useState("");
  const [randomFallback, setRandomFallback] = useState(true);
  const [useOverride, setUseOverride] = useState(false);
  
  // Delay state
  const [minDelay, setMinDelay] = useState(2);
  const [maxDelay, setMaxDelay] = useState(8);
  const [useDelayOverride, setUseDelayOverride] = useState(false);
  
  // Blacklist state
  const [blacklistEntries, setBlacklistEntries] = useState<TargetBlacklist[]>([]);
  const [newBlacklistEntry, setNewBlacklistEntry] = useState("");
  
  // Pairs state (for two-step actions)
  const [pairs, setPairs] = useState<TargetPair[]>([]);
  const [newPairA, setNewPairA] = useState("");
  const [newPairB, setNewPairB] = useState("");
  
  const [saving, setSaving] = useState(false);
  
  // Validation errors
  const [delayError, setDelayError] = useState<string | undefined>();

  // Fetch existing data when dialog opens
  useEffect(() => {
    let cancelled = false;

    if (open) {
      setActiveTab("targets");
      void (async () => {
        await loadExistingData(() => cancelled);
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [open, accountId, action.id]);

  const loadExistingData = async (isCancelled: () => boolean) => {
    try {
      // Load target override
      const override = await getTargetOverride(accountId, action.id);
      if (isCancelled()) return;

      if (override) {
        setUseOverride(true);
        const rule: TargetRule = JSON.parse(override.rule_json);
        setTargets(rule.targets?.join(", ") || "");
        setRandomFallback(rule.random_fallback ?? true);
      } else {
        setUseOverride(false);
        setTargets("");
        setRandomFallback(true);
      }
      
      // Load delay override
      const delayOvr = await getDelayOverride(accountId, action.id);
      if (isCancelled()) return;

      if (delayOvr) {
        setUseDelayOverride(true);
        setMinDelay(delayOvr.min_seconds);
        setMaxDelay(delayOvr.max_seconds);
      } else {
        setUseDelayOverride(false);
        setMinDelay(2);
        setMaxDelay(8);
      }
      
      // Load blacklist
      const bl = await listBlacklist(accountId, action.id);
      if (isCancelled()) return;
      setBlacklistEntries(bl);
      
      // Load pairs (for two-step actions)
      if (action.is_two_step) {
        const p = await listTargetPairs(accountId, action.id);
        if (isCancelled()) return;
        setPairs(p);
      }
    } catch (err) {
      if (!isCancelled()) {
        toast.error("Failed to load target data", { description: getErrorMessage(err) });
      }
    }
  };

  const handleSave = async () => {
    // Validate delay before saving
    if (useDelayOverride) {
      const result = validateDelay(minDelay, maxDelay);
      if (!result.valid) {
        setDelayError(result.error);
        toast.error("Invalid delay", { description: result.error });
        return;
      }
    }
    
    setSaving(true);
    try {
      // Save target override
      if (useOverride) {
        const targetList = targets.split(",").map(t => t.trim()).filter(t => t);
        const rule: TargetRule = {
          type: action.button_type,
          targets: targetList,
          random_fallback: randomFallback,
        };
        await setTargetOverride(accountId, action.id, JSON.stringify(rule));
      } else {
        await deleteTargetOverride(accountId, action.id);
      }
      
      // Save delay override
      if (useDelayOverride) {
        await setDelayOverride(accountId, action.id, minDelay, maxDelay);
      } else {
        await deleteDelayOverride(accountId, action.id);
      }
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["targetOverrides", accountId] });
      queryClient.invalidateQueries({ queryKey: ["delayOverrides", accountId] });
      queryClient.invalidateQueries({ queryKey: ["action-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["account-overrides"] });
      
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to save", { description: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleAddBlacklist = async () => {
    if (!newBlacklistEntry.trim()) return;
    try {
      const entry = await addBlacklistEntry(accountId, action.id, newBlacklistEntry.trim());
      setBlacklistEntries([...blacklistEntries, entry]);
      setNewBlacklistEntry("");
    } catch (err) {
      toast.error("Failed to add blacklist entry", { description: getErrorMessage(err) });
    }
  };

  const handleRemoveBlacklist = async (entryId: number) => {
    try {
      await removeBlacklistEntry(entryId);
      setBlacklistEntries(blacklistEntries.filter(e => e.id !== entryId));
    } catch (err) {
      toast.error("Failed to remove blacklist entry", { description: getErrorMessage(err) });
    }
  };

  const handleAddPair = async () => {
    if (!newPairA.trim() || !newPairB.trim()) return;
    try {
      const pair = await addTargetPair(accountId, action.id, newPairA.trim(), newPairB.trim());
      setPairs([...pairs, pair]);
      setNewPairA("");
      setNewPairB("");
    } catch (err) {
      toast.error("Failed to add target pair", { description: getErrorMessage(err) });
    }
  };

  const handleRemovePair = async (pairId: number) => {
    try {
      await removeTargetPair(pairId);
      setPairs(pairs.filter(p => p.id !== pairId));
    } catch (err) {
      toast.error("Failed to remove target pair", { description: getErrorMessage(err) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Configure Target: {action.name}</DialogTitle>
          <DialogDescription>
            Account: {accountName} • Button Type: {action.button_type === "player_list" ? "Player List" : action.button_type === "yes_no" ? "Yes/No" : "Fixed"}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className={cn("grid w-full", action.is_two_step ? "grid-cols-4" : "grid-cols-3")}>
            <TabsTrigger value="targets">
              <IconSettings className="size-4 mr-1" />
              Targets
            </TabsTrigger>
            <TabsTrigger value="delay">
              <IconClock className="size-4 mr-1" />
              Delay
            </TabsTrigger>
            <TabsTrigger value="blacklist">
              <IconBan className="size-4 mr-1" />
              Blacklist
            </TabsTrigger>
            {action.is_two_step && (
              <TabsTrigger value="pairs">
                <IconHeart className="size-4 mr-1" />
                Pairs
              </TabsTrigger>
            )}
          </TabsList>
          
          <div className="flex-1 overflow-y-auto py-4">
            {/* Targets Tab */}
            <TabsContent value="targets" className="mt-0 space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="use-override">Use custom targets (override default)</Label>
                <Switch
                  id="use-override"
                  checked={useOverride}
                  onCheckedChange={setUseOverride}
                />
              </div>
              
              {useOverride && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="targets">Target Names (priority order)</Label>
                    <Input
                      id="targets"
                      value={targets}
                      onChange={(e) => setTargets(e.target.value)}
                      placeholder="Player1, Player2, Player3"
                    />
                    <p className="text-xs text-muted-foreground">
                      Comma-separated list of player names to target in priority order
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="random-fallback">Random Fallback</Label>
                      <p className="text-xs text-muted-foreground">
                        Pick random target if none from list are available
                      </p>
                    </div>
                    <Switch
                      id="random-fallback"
                      checked={randomFallback}
                      onCheckedChange={setRandomFallback}
                    />
                  </div>
                </>
              )}
              
              {!useOverride && (
                <p className="text-sm text-muted-foreground">
                  Using global default targeting rules for this action.
                </p>
              )}
            </TabsContent>
            
            {/* Delay Tab */}
            <TabsContent value="delay" className="mt-0 space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="use-delay-override">Use custom delay (override default)</Label>
                <Switch
                  id="use-delay-override"
                  checked={useDelayOverride}
                  onCheckedChange={setUseDelayOverride}
                />
              </div>
              
              {useDelayOverride && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="min-delay">Min Delay (seconds)</Label>
                      <Input
                        id="min-delay"
                        type="number"
                        min={0}
                        max={300}
                        value={minDelay}
                        onChange={(e) => {
                          const newMin = parseInt(e.target.value) || 0;
                          setMinDelay(newMin);
                          const result = validateDelay(newMin, maxDelay);
                          setDelayError(result.error);
                        }}
                        className={delayError ? "border-destructive" : ""}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-delay">Max Delay (seconds)</Label>
                      <Input
                        id="max-delay"
                        type="number"
                        min={0}
                        max={300}
                        value={maxDelay}
                        onChange={(e) => {
                          const newMax = parseInt(e.target.value) || 0;
                          setMaxDelay(newMax);
                          const result = validateDelay(minDelay, newMax);
                          setDelayError(result.error);
                        }}
                        className={delayError ? "border-destructive" : ""}
                      />
                    </div>
                  </div>
                  {delayError && (
                    <p className="text-xs text-destructive">{delayError}</p>
                  )}
                </div>
              )}
              
              {!useDelayOverride && (
                <p className="text-sm text-muted-foreground">
                  Using global default delay (2-8 seconds).
                </p>
              )}
            </TabsContent>
            
            {/* Blacklist Tab */}
            <TabsContent value="blacklist" className="mt-0 space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newBlacklistEntry}
                  onChange={(e) => setNewBlacklistEntry(e.target.value)}
                  placeholder="Enter player name to blacklist"
                  onKeyDown={(e) => e.key === "Enter" && handleAddBlacklist()}
                />
                <Button onClick={handleAddBlacklist} disabled={!newBlacklistEntry.trim()} aria-label="Add blacklist entry">
                  <IconPlus className="size-4" />
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Blacklisted players will never be targeted by random selection. Explicit targets always override the blacklist.
              </p>
              
              {blacklistEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No blacklisted players for this action.
                </p>
              ) : (
                <div className="space-y-2">
                  {blacklistEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-2 border rounded">
                      <span>{entry.button_text}</span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemoveBlacklist(entry.id)}
                        aria-label="Remove blacklist entry"
                      >
                        <IconTrash className="size-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            
            {/* Pairs Tab (for two-step actions like Cupid) */}
            {action.is_two_step && (
              <TabsContent value="pairs" className="mt-0 space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={newPairA}
                    onChange={(e) => setNewPairA(e.target.value)}
                    placeholder="First target (A)"
                    className="flex-1"
                  />
                  <Input
                    value={newPairB}
                    onChange={(e) => setNewPairB(e.target.value)}
                    placeholder="Second target (B)"
                    className="flex-1"
                  />
                  <Button onClick={handleAddPair} disabled={!newPairA.trim() || !newPairB.trim()} aria-label="Add target pair">
                    <IconPlus className="size-4" />
                  </Button>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  For two-step actions (like Cupid), define pairs of targets. The first available pair will be used.
                </p>
                
                {pairs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No pairs configured. Add pairs above or random selection will be used.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {pairs.map((pair, index) => (
                      <div key={pair.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{index + 1}</Badge>
                          <span>{pair.target_a}</span>
                          <IconHeart className="size-4 text-pink-500" />
                          <span>{pair.target_b}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRemovePair(pair.id)}
                          aria-label="Remove target pair"
                        >
                          <IconTrash className="size-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            )}
          </div>
        </Tabs>
        
        <Separator />
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !!delayError}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
            {accountsLoading ? (
              <ListSkeleton rows={4} />
            ) : accounts.length === 0 ? (
              <EmptyState
                icon={<IconTarget className="h-8 w-8 text-muted-foreground" />}
                title="No accounts yet"
                description="Add accounts first to configure targeting rules."
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Account List */}
                <div className="lg:col-span-1">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Accounts</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y" ref={accountsListParent}>
                        {accounts.map((account) => (
                          <div
                            key={account.id}
                            className={`p-3 cursor-pointer hover:bg-muted/50 flex items-center justify-between ${
                              selectedAccountId === account.id ? "bg-muted" : ""
                            }`}
                            onClick={() => setSelectedAccountId(account.id)}
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
                                handleStartCopy(account);
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

                {/* Target Configuration */}
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
                            onClick={() =>
                              handleStartCopy(accounts.find((a) => a.id === selectedAccountId)!)
                            }
                          >
                            <IconCopy className="size-4 mr-1" />
                            Copy Targets
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {actions.length === 0 ? (
                          <div className="text-center py-4 text-muted-foreground">
                            No actions configured yet.
                          </div>
                        ) : (
                          <div className="space-y-3" ref={actionsListParent}>
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
                                    onClick={() => openConfigDialog(
                                      selectedAccountId!,
                                      accounts.find((a) => a.id === selectedAccountId)?.account_name || "",
                                      action
                                    )}
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
            )}
          </TabsContent>

          {/* Action-First View */}
          <TabsContent value="action">
            {actionsLoading ? (
              <ListSkeleton rows={4} />
            ) : actions.length === 0 ? (
              <EmptyState
                icon={<IconTarget className="h-8 w-8 text-muted-foreground" />}
                title="No actions yet"
                description="Add actions first to configure targeting rules."
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Action List */}
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
                            onClick={() => setSelectedActionId(action.id)}
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

                {/* Account Targets for Action */}
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
                          <div className="text-center py-4 text-muted-foreground">
                            No accounts configured yet.
                          </div>
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
                                    <TableCell className="font-medium">
                                      {account.account_name}
                                    </TableCell>
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
                                            openConfigDialog(account.id, account.account_name, action);
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
            )}
          </TabsContent>
        </Tabs>

        {/* Copy Actions Dialog */}
        <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Copy Targets</DialogTitle>
              <DialogDescription>
                Select which action targets to copy from "{copiedFromAccount?.account_name}".
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 max-h-64 overflow-y-auto">
              {actions.map((action) => (
                <div
                  key={action.id}
                  className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded"
                >
                  <Checkbox
                    checked={selectedActionsToCopy.has(action.id)}
                    onCheckedChange={() => toggleActionToCopy(action.id)}
                  />
                  <span>{action.name}</span>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCopy} disabled={selectedActionsToCopy.size === 0}>
                <IconCopy className="size-4 mr-1" />
                Copy ({selectedActionsToCopy.size})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Paste to Accounts Dialog */}
        <Dialog open={pasteDialogOpen} onOpenChange={setPasteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Paste Targets</DialogTitle>
              <DialogDescription>
                Select accounts to paste targets to. This will overwrite existing targets.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 max-h-64 overflow-y-auto">
              {accounts
                .filter((a) => a.id !== copiedFromAccount?.id)
                .map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded"
                  >
                    <Checkbox
                      checked={selectedAccountsToPaste.has(account.id)}
                      onCheckedChange={() => toggleAccountToPaste(account.id)}
                    />
                    <span>{account.account_name}</span>
                  </div>
                ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPasteDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handlePaste} disabled={selectedAccountsToPaste.size === 0 || pasting}>
                <IconClipboard className="size-4 mr-1" />
                {pasting ? "Pasting..." : `Paste to (${selectedAccountsToPaste.size}) accounts`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
