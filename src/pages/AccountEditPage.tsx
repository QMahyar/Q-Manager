import { useState, useEffect } from "react";
import { invoke } from "@/lib/transport";
import { useParams } from "react-router-dom";
import { PageTransition } from "@/components/motion/PageTransition";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  IconDeviceFloppy,
  IconRefresh,
  IconSearch,
  IconUser,
  IconDevices,
  IconPlayerPlay,
  IconAlertTriangle,
  IconCircleCheck,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedBadge } from "@/components/motion";

// Plain stand-in for the former motion.create(Card): accepts and ignores the
// motion animation props that call sites still pass, forwarding the rest.
function MotionCard({ initial, animate, exit, transition, ...props }: any) {
  void initial;
  void animate;
  void exit;
  void transition;
  return <Card {...props} />;
}
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listAccounts, checkAccountNameExists, invokeCommand, updateGroupSlot, getGroupSlots, initGroupSlots } from "@/lib/api";
import { validateAccountName, validateJoinRules, validateProxyUrl } from "@/lib/validation";
import { toast } from "@/components/ui/sonner";
import { toastError } from "@/lib/toast-utils";

interface GroupSlot {
  id: number;
  account_id: number;
  slot: number;
  enabled: boolean;
  group_id: number | null;
  group_title: string | null;
  moderator_kind: string;
}

interface TelegramGroup {
  id: number;
  title: string;
  group_type: string;
  member_count: number | null;
}

export default function AccountEditPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const rawId = parseInt(id || "0");
  const accountId = isNaN(rawId) ? 0 : rawId;

  const [hasChanges, setHasChanges] = useState(false);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [duplicateGroupWarning, setDuplicateGroupWarning] = useState<string | null>(null);

  // Form state
  const [accountName, setAccountName] = useState("");
  const [joinMaxAttemptsOverride, setJoinMaxAttemptsOverride] = useState("");
  const [joinCooldownOverride, setJoinCooldownOverride] = useState("");
  const [proxyUrl, setProxyUrl] = useState("");
  const [slots, setSlots] = useState<GroupSlot[]>([]);
  
  // Validation errors
  const [errors, setErrors] = useState<{
    accountName?: string;
    joinRules?: string;
    proxy?: string;
  }>({});

  // Fetch account
  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: listAccounts,
  });

  const account = accounts.find((a) => a.id === accountId);

  // Fetch group slots
  const { data: groupSlots = [] } = useQuery({
    queryKey: ["group-slots", accountId],
    queryFn: () => getGroupSlots(accountId),
    enabled: accountId > 0,
  });

  // Initialize group slots once on mount (not inside queryFn to avoid repeated side effects on refetch)
  useEffect(() => {
    if (accountId > 0) {
      void initGroupSlots(accountId);
    }
  }, [accountId]);

  // Fetch available groups (placeholder)
  const {
    data: availableGroups = [],
    isLoading: loadingGroups,
    refetch: refetchGroups,
    error: groupsError,
  } = useQuery({
    queryKey: ["telegram-groups", accountId],
    queryFn: () => invoke<TelegramGroup[]>("account_fetch_groups", { accountId }),
    enabled: false, // Only fetch when requested
  });

  // Initialize form state when data loads
  useEffect(() => {
    if (!account || hasChanges) {
      return;
    }
    setAccountName(account.account_name);
    setJoinMaxAttemptsOverride(account.join_max_attempts_override?.toString() || "");
    setJoinCooldownOverride(account.join_cooldown_seconds_override?.toString() || "");
    setProxyUrl(account.proxy_url || "");
  }, [account, hasChanges]);

  useEffect(() => {
    if (groupSlots.length > 0) {
      setSlots(groupSlots);
    } else if (accountId > 0) {
      // Create default slots if none exist
      setSlots([
        { id: 0, account_id: accountId, slot: 1, enabled: false, group_id: null, group_title: null, moderator_kind: "main" },
        { id: 0, account_id: accountId, slot: 2, enabled: false, group_id: null, group_title: null, moderator_kind: "main" },
      ]);
    }
  }, [groupSlots, accountId]);

  // Validation handlers
  const validateFields = (): boolean => {
    let isValid = true;
    const newErrors: typeof errors = {};
    
    // Validate account name
    if (accountName.trim()) {
      const result = validateAccountName(accountName);
      if (!result.valid) {
        newErrors.accountName = result.error;
        isValid = false;
      }
    }
    
    // Validate join rules if either is set
    if (joinMaxAttemptsOverride || joinCooldownOverride) {
      const maxAttempts = parseInt(joinMaxAttemptsOverride) || 5;
      const cooldown = parseInt(joinCooldownOverride) || 5;
      const result = validateJoinRules(maxAttempts, cooldown);
      if (!result.valid) {
        newErrors.joinRules = result.error;
        isValid = false;
      }
    }

    // Validate proxy (empty is allowed = direct connection)
    const proxyResult = validateProxyUrl(proxyUrl);
    if (!proxyResult.valid) {
      newErrors.proxy = proxyResult.error;
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  // Update account mutation
  const joinCooldownWarning = joinCooldownOverride
    ? (() => {
        const cooldown = parseInt(joinCooldownOverride) || 0;
        if (cooldown <= 0) {
          return "Cooldown is set to 0 seconds. This may cause rapid join attempts.";
        }
        if (cooldown < 2) {
          return "Cooldown is very low. Consider 2+ seconds to avoid rapid retries.";
        }
        return "";
      })()
    : "";

  const updateAccountMutation = useMutation({
    mutationFn: async () => {
      // Validate before saving
      if (!validateFields()) {
        throw new Error("Please fix validation errors before saving");
      }
      
      // Check if account name changed and if it conflicts with another account
      const originalName = account?.account_name || "";
      if (accountName.trim().toLowerCase() !== originalName.toLowerCase()) {
        const exists = await checkAccountNameExists(accountName.trim());
        if (exists) {
          setErrors(prev => ({ ...prev, accountName: "An account with this name already exists" }));
          throw new Error("An account with this name already exists");
        }
      }
      
      // Update account details
      await invokeCommand("account_update", {
        payload: {
          id: accountId,
          account_name: accountName,
          join_max_attempts_override: joinMaxAttemptsOverride ? parseInt(joinMaxAttemptsOverride) : null,
          join_cooldown_seconds_override: joinCooldownOverride ? parseInt(joinCooldownOverride) : null,
          // Empty string clears the proxy (backend normalizes "" -> NULL).
          proxy_url: proxyUrl.trim() || null,
        },
      });

      // Update slots
      for (const slot of slots) {
        await updateGroupSlot(accountId, slot.slot, {
          enabled: slot.enabled,
          group_id: slot.group_id,
          group_title: slot.group_title,
          moderator_kind: slot.moderator_kind as "main" | "beta" | undefined,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["group-slots", accountId] });
      setHasChanges(false);
      toast.success("Account saved");
    },
    onError: (error) => {
      toastError("Failed to save", error);
    },
  });

  const markChanged = () => {
    if (!hasChanges) setHasChanges(true);
  };

  const updateSlot = (slotNum: number, updates: Partial<GroupSlot>) => {
    setSlots((prev) => {
      const next = prev.map((s) => (s.slot === slotNum ? { ...s, ...updates } : s));
      const enabledSlots = next.filter((s) => s.enabled && s.group_id);
      const duplicate = enabledSlots.find((slot, index) =>
        enabledSlots.some((other, otherIndex) => otherIndex !== index && other.group_id === slot.group_id)
      );
      if (duplicate) {
        setDuplicateGroupWarning("Both slots reference the same group. Consider picking different groups.");
      } else {
        setDuplicateGroupWarning(null);
      }
      return next;
    });
    markChanged();
  };

  const handleSave = () => {
    updateAccountMutation.mutate();
  };

  const openGroupPicker = (slotNum: number) => {
    setActiveSlot(slotNum);
    setSearchQuery("");
    setGroupPickerOpen(true);
    refetchGroups();
  };

  const selectGroup = (group: TelegramGroup) => {
    updateSlot(activeSlot, {
      group_id: group.id,
      group_title: group.title,
    });
    setGroupPickerOpen(false);
  };

  const clearGroup = (slotNum: number) => {
    updateSlot(slotNum, {
      group_id: null,
      group_title: null,
    });
  };

  const filteredGroups = availableGroups.filter((g: TelegramGroup) =>
    g.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (accountsLoading) {
    return (
      <PageTransition className="min-h-screen flex flex-col">
        <PageHeader title="Edit Account" backTo="/accounts" />
        <main className="flex-1 p-6 flex items-center justify-center">
          <p className="text-muted-foreground">Loading account...</p>
        </main>
      </PageTransition>
    );
  }

  if (!account) {
    return (
      <PageTransition className="min-h-screen flex flex-col">
        <PageHeader title="Account Not Found" backTo="/accounts" />
        <main className="flex-1 p-6 flex items-center justify-center">
          <p className="text-muted-foreground">The requested account does not exist.</p>
        </main>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="min-h-screen flex flex-col">
      <PageHeader
        title="Edit Account"
        description={account.telegram_name || account.phone || `ID: ${account.user_id}`}
        backTo="/accounts"
        icon={IconUser}
        iconColor="text-sky-500"
      >
        <Button onClick={handleSave} disabled={!hasChanges || updateAccountMutation.isPending}>
          <IconDeviceFloppy className="size-4 mr-1" />
          {updateAccountMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </PageHeader>

      <main className="flex-1 p-6 space-y-6 w-full max-w-3xl mx-auto">
        {/* Account Info */}
        <MotionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0 }}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-500/10">
                <IconUser className="size-4 text-sky-500" />
              </div>
              <div>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>Basic account details</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="accountName">Account Name</Label>
              <Input
                id="accountName"
                value={accountName}
                onChange={(e) => {
                  setAccountName(e.target.value);
                  const result = validateAccountName(e.target.value);
                  setErrors(prev => ({ ...prev, accountName: result.error }));
                  markChanged();
                }}
                className={errors.accountName ? "border-destructive" : ""}
              />
              {errors.accountName && (
                <p className="text-xs text-destructive">{errors.accountName}</p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-muted/40 border border-border/60 px-3 py-2.5">
                <p className="text-xs text-muted-foreground mb-0.5">Telegram Name</p>
                <p className="text-sm font-medium">{account.telegram_name || "—"}</p>
              </div>
              <div className="rounded-lg bg-muted/40 border border-border/60 px-3 py-2.5">
                <p className="text-xs text-muted-foreground mb-0.5">Phone</p>
                <p className="text-sm font-medium">{account.phone || "—"}</p>
              </div>
              <div className="rounded-lg bg-muted/40 border border-border/60 px-3 py-2.5">
                <p className="text-xs text-muted-foreground mb-0.5">User ID</p>
                <p className="text-sm font-mono font-medium">{account.user_id || "—"}</p>
              </div>
              <div className="rounded-lg bg-muted/40 border border-border/60 px-3 py-2.5">
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <AnimatedBadge status={account.status as import("@/lib/types").AccountStatus} />
              </div>
            </div>
          </CardContent>
        </MotionCard>

        {/* Group Slots */}
        <MotionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <IconDevices className="size-4 text-emerald-500" />
              </div>
              <div>
                <CardTitle>Game Groups</CardTitle>
                <CardDescription>
                  Configure up to 2 Werewolf game groups for this account
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {duplicateGroupWarning && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                <IconAlertTriangle className="size-4 mt-0.5 shrink-0" />
                {duplicateGroupWarning}
              </div>
            )}
            {slots.map((slot) => (
              <div key={slot.slot} className={`border rounded-lg p-4 transition-colors ${slot.enabled ? "border-border bg-muted/20" : "border-border/50 bg-transparent"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`size-7 rounded-md flex items-center justify-center text-xs font-bold ${slot.enabled ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                      {slot.slot}
                    </div>
                    <span className="font-medium text-sm">Slot {slot.slot}</span>
                    <Switch
                      checked={slot.enabled}
                      onCheckedChange={(checked) => updateSlot(slot.slot, { enabled: checked })}
                    />
                    <span className={`text-xs font-medium ${slot.enabled ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                      {slot.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>

                {slot.enabled && (
                  <div className="space-y-4 pt-3 border-t border-border/50">
                    {/* Group Selection */}
                    <div className="grid gap-2">
                      <Label>Game Group</Label>
                      <div className="flex flex-wrap gap-2">
                        {slot.group_title ? (
                          <div className="flex-1 flex items-center justify-between border border-emerald-500/30 bg-emerald-500/5 rounded-md px-3 py-2">
                            <div className="flex items-center gap-2">
                              <IconCircleCheck className="size-4 text-emerald-500 shrink-0" />
                              <span className="text-sm font-medium">{slot.group_title}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => clearGroup(slot.slot)}
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 px-2"
                            >
                              <IconX className="size-3.5 mr-1" />
                              Clear
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            className="flex-1 border-dashed"
                            onClick={() => openGroupPicker(slot.slot)}
                          >
                            <IconSearch className="size-4 mr-2" />
                            Select Group
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => openGroupPicker(slot.slot)}
                          title="Refresh groups"
                        >
                          <IconRefresh className="size-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Moderator Bot Selection */}
                    <div className="grid gap-2">
                      <Label>Moderator Bot</Label>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={slot.moderator_kind === "main" ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateSlot(slot.slot, { moderator_kind: "main" })}
                          className={slot.moderator_kind === "main" ? "" : "border-border/60"}
                        >
                          Main Bot
                        </Button>
                        <Button
                          variant={slot.moderator_kind === "beta" ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateSlot(slot.slot, { moderator_kind: "beta" })}
                          className={slot.moderator_kind === "beta" ? "" : "border-border/60"}
                        >
                          Beta Bot
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </MotionCard>

        {/* Join Rules Overrides */}
        <MotionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.24 }}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <IconPlayerPlay className="size-4 text-orange-500" />
              </div>
              <div>
                <CardTitle>Join Rules Overrides</CardTitle>
                <CardDescription>
                  Override global join settings for this account (leave empty to use global defaults)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="joinMaxAttemptsOverride">Max Join Attempts</Label>
                <Input
                  id="joinMaxAttemptsOverride"
                  type="number"
                  value={joinMaxAttemptsOverride}
                  onChange={(e) => {
                    setJoinMaxAttemptsOverride(e.target.value);
                    if (e.target.value || joinCooldownOverride) {
                      const maxAttempts = parseInt(e.target.value) || 5;
                      const cooldown = parseInt(joinCooldownOverride) || 5;
                      const result = validateJoinRules(maxAttempts, cooldown);
                      setErrors(prev => ({ ...prev, joinRules: result.error }));
                    } else {
                      setErrors(prev => ({ ...prev, joinRules: undefined }));
                    }
                    markChanged();
                  }}
                  placeholder="Use global default (5)"
                  className={errors.joinRules ? "border-destructive" : ""}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="joinCooldownOverride">Cooldown (seconds)</Label>
                <Input
                  id="joinCooldownOverride"
                  type="number"
                  value={joinCooldownOverride}
                  onChange={(e) => {
                    const cooldown = parseInt(e.target.value) || 5;
                    const maxAttempts = parseInt(joinMaxAttemptsOverride) || 5;
                    if (e.target.value || joinMaxAttemptsOverride) {
                      const result = validateJoinRules(maxAttempts, cooldown);
                      setErrors(prev => ({ ...prev, joinRules: result.error }));
                    } else {
                      setErrors(prev => ({ ...prev, joinRules: undefined }));
                    }
                    setJoinCooldownOverride(e.target.value);
                    markChanged();
                  }}
                  placeholder="Use global default (5)"
                  className={errors.joinRules ? "border-destructive" : ""}
                />
              </div>
            </div>
            {errors.joinRules && (
              <p className="text-xs text-destructive">{errors.joinRules}</p>
            )}
            {!errors.joinRules && joinCooldownWarning && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
                <IconAlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                {joinCooldownWarning}
              </div>
            )}
          </CardContent>
        </MotionCard>

        {/* Proxy */}
        <MotionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.28 }}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10">
                <IconDevices className="size-4 text-indigo-500" />
              </div>
              <div>
                <CardTitle>Proxy</CardTitle>
                <CardDescription>
                  Route this account's connection through a proxy so accounts don't all
                  share one IP. Leave empty for a direct connection. Applied on next start.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="proxyUrl">Proxy URL</Label>
            <Input
              id="proxyUrl"
              value={proxyUrl}
              onChange={(e) => {
                setProxyUrl(e.target.value);
                setErrors((prev) => ({ ...prev, proxy: validateProxyUrl(e.target.value).error }));
                markChanged();
              }}
              placeholder="socks5://user:pass@host:1080"
              className={errors.proxy ? "border-destructive" : ""}
              autoComplete="off"
              spellCheck={false}
            />
            {errors.proxy ? (
              <p className="text-xs text-destructive">{errors.proxy}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Supports <code>socks5://</code>, <code>socks4://</code>, <code>http://</code>, and
                MTProto (<code>mtproto://host:port?secret=…</code> or a <code>tg://proxy?…</code> link).
              </p>
            )}
          </CardContent>
        </MotionCard>

        {/* Unsaved changes indicator */}
        {hasChanges && (
          <div className="fixed bottom-6 right-6 bg-background border border-border shadow-xl rounded-xl px-4 py-3 flex items-center gap-3 backdrop-blur-sm">
            <div className="size-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm font-medium text-foreground">Unsaved changes</span>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateAccountMutation.isPending}
            >
              <IconDeviceFloppy className="size-3.5 mr-1.5" />
              {updateAccountMutation.isPending ? "Saving..." : "Save Now"}
            </Button>
          </div>
        )}
      </main>

      {/* Group Picker Dialog */}
      <Dialog open={groupPickerOpen} onOpenChange={setGroupPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Game Group</DialogTitle>
            <DialogDescription>
              Choose a group for Slot {activeSlot}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button variant="outline" onClick={() => refetchGroups()}>
                <IconRefresh className="size-4" />
              </Button>
            </div>

            <div className="max-h-64 overflow-y-auto border rounded-lg">
              {loadingGroups ? (
                <div className="p-6 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                  <IconRefresh className="size-5 animate-spin opacity-50" />
                  Loading groups...
                </div>
              ) : groupsError ? (
                <div className="p-4 text-center">
                  <div className="flex items-center gap-2 justify-center text-destructive text-sm mb-1">
                    <IconAlertTriangle className="size-4" />
                    Failed to load groups
                  </div>
                  <p className="text-xs text-muted-foreground">Ensure the account is logged in and try again.</p>
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {availableGroups.length === 0
                    ? "No groups found. Start the account once to refresh chats, then try again."
                    : "No groups match your search."}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredGroups.map((group: TelegramGroup) => (
                    <div
                      key={group.id}
                      className="p-3 hover:bg-primary/5 cursor-pointer transition-colors border-l-2 border-l-transparent hover:border-l-primary/40"
                      onClick={() => selectGroup(group)}
                    >
                      <div className="font-medium text-sm">{group.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {group.group_type}
                        {group.member_count !== null && ` · ${group.member_count} members`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupPickerOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
