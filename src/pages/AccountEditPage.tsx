import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Motion-enhanced Card
const MotionCard = motion.create(Card);
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listAccounts, checkAccountNameExists, invokeCommand, updateGroupSlot, getGroupSlots, initGroupSlots } from "@/lib/api";
import { validateAccountName, validateJoinRules } from "@/lib/validation";
import { toast } from "@/components/ui/sonner";
import { getErrorMessage } from "@/lib/error-utils";

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accountId = parseInt(id || "0");

  const [hasChanges, setHasChanges] = useState(false);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [duplicateGroupWarning, setDuplicateGroupWarning] = useState<string | null>(null);

  // Form state
  const [accountName, setAccountName] = useState("");
  const [joinMaxAttemptsOverride, setJoinMaxAttemptsOverride] = useState("");
  const [joinCooldownOverride, setJoinCooldownOverride] = useState("");
  const [slots, setSlots] = useState<GroupSlot[]>([]);
  
  // Validation errors
  const [errors, setErrors] = useState<{
    accountName?: string;
    joinRules?: string;
  }>({});

  // Fetch account
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: listAccounts,
  });

  const account = accounts.find((a) => a.id === accountId);

  // Fetch group slots
  const { data: groupSlots = [] } = useQuery({
    queryKey: ["group-slots", accountId],
    queryFn: async () => {
      // Initialize slots first
      await initGroupSlots(accountId);
      return getGroupSlots(accountId);
    },
    enabled: accountId > 0,
  });

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
      toast.error("Failed to save", { description: getErrorMessage(error) });
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

  if (!account) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-border px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/accounts")}>
              <IconArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Account Not Found</h1>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 flex items-center justify-center">
          <p className="text-muted-foreground">The requested account does not exist.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PageHeader
        title="Edit Account"
        description={account.telegram_name || account.phone || `ID: ${account.user_id}`}
        backTo="/accounts"
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
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Basic account details</CardDescription>
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Telegram Name</Label>
                <p className="text-sm">{account.telegram_name || "-"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Phone</Label>
                <p className="text-sm">{account.phone || "-"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">User ID</Label>
                <p className="text-sm font-mono">{account.user_id || "-"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <p className="text-sm">
                  <Badge variant={account.status === "running" ? "default" : "secondary"}>
                    {account.status}
                  </Badge>
                </p>
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
            <CardTitle>Game Groups</CardTitle>
            <CardDescription>
              Configure up to 2 Werewolf game groups for this account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {duplicateGroupWarning && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {duplicateGroupWarning}
              </div>
            )}
            {slots.map((slot) => (
              <div key={slot.slot} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium">Slot {slot.slot}</h4>
                    <Switch
                      checked={slot.enabled}
                      onCheckedChange={(checked) => updateSlot(slot.slot, { enabled: checked })}
                    />
                    <span className="text-sm text-muted-foreground">
                      {slot.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>

                {slot.enabled && (
                  <div className="space-y-4">
                    {/* Group Selection */}
                    <div className="grid gap-2">
                      <Label>Game Group</Label>
                      <div className="flex gap-2">
                        {slot.group_title ? (
                          <div className="flex-1 flex items-center justify-between border rounded-md px-3 py-2">
                            <span>{slot.group_title}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => clearGroup(slot.slot)}
                            >
                              Clear
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            className="flex-1"
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
                        >
                          <IconRefresh className="size-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Moderator Bot Selection */}
                    <div className="grid gap-2">
                      <Label>Moderator Bot</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={slot.moderator_kind === "main" ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateSlot(slot.slot, { moderator_kind: "main" })}
                        >
                          Main Bot
                        </Button>
                        <Button
                          variant={slot.moderator_kind === "beta" ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateSlot(slot.slot, { moderator_kind: "beta" })}
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
            <CardTitle>Join Rules Overrides</CardTitle>
            <CardDescription>
              Override global join settings for this account (leave empty to use global defaults)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
              <p className="text-xs text-warning">{joinCooldownWarning}</p>
            )}
          </CardContent>
        </MotionCard>

        {/* Unsaved changes indicator */}
        {hasChanges && (
          <div className="fixed bottom-6 right-6 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-3">
            <span>You have unsaved changes</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSave}
              disabled={updateAccountMutation.isPending}
            >
              Save Now
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

            <div className="max-h-64 overflow-y-auto border rounded-md">
              {loadingGroups ? (
                <div className="p-4 text-center text-muted-foreground">
                  Loading groups...
                </div>
              ) : groupsError ? (
                <div className="p-4 text-center text-muted-foreground">
                  Failed to load groups. Ensure the account is logged in and try again.
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {availableGroups.length === 0
                    ? "No groups found. Start the account once to refresh chats, then try again."
                    : "No groups match your search."}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredGroups.map((group: TelegramGroup) => (
                    <div
                      key={group.id}
                      className="p-3 hover:bg-muted/50 cursor-pointer"
                      onClick={() => selectGroup(group)}
                    >
                      <div className="font-medium">{group.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {group.group_type}
                        {group.member_count !== null && ` • ${group.member_count} members`}
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
    </div>
  );
}
