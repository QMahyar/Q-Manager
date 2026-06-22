import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  addBlacklistEntry,
  addTargetPair,
  deleteDelayOverride,
  deleteTargetOverride,
  getDelayOverride,
  getTargetOverride,
  listBlacklist,
  listTargetPairs,
  removeBlacklistEntry,
  removeTargetPair,
  setDelayOverride,
  setTargetOverride,
} from "@/lib/api";
import type { Action, TargetBlacklist, TargetPair, TargetRule } from "@/lib/types";
import { validateDelay } from "@/lib/validation";
import { toastError } from "@/lib/toast-utils";
import { IconBan, IconClock, IconHeart, IconPlus, IconSettings, IconTrash, IconInfoCircle } from "@tabler/icons-react";

interface TargetConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: number;
  action: Action;
  accountName: string;
}

export function TargetConfigDialog({ open, onOpenChange, accountId, action, accountName }: TargetConfigDialogProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"targets" | "delay" | "blacklist" | "pairs">("targets");
  const [targets, setTargets] = useState("");
  const [randomFallback, setRandomFallback] = useState(true);
  const [useOverride, setUseOverride] = useState(false);
  const [minDelay, setMinDelay] = useState(2);
  const [maxDelay, setMaxDelay] = useState(8);
  const [useDelayOverride, setUseDelayOverride] = useState(false);
  const [blacklistEntries, setBlacklistEntries] = useState<TargetBlacklist[]>([]);
  const [newBlacklistEntry, setNewBlacklistEntry] = useState("");
  const [pairs, setPairs] = useState<TargetPair[]>([]);
  const [newPairA, setNewPairA] = useState("");
  const [newPairB, setNewPairB] = useState("");
  const [saving, setSaving] = useState(false);
  const [delayError, setDelayError] = useState<string | undefined>();

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
      const override = await getTargetOverride(accountId, action.id);
      if (isCancelled()) return;

      if (override) {
        setUseOverride(true);
        let rule: TargetRule | null = null;
        try {
          rule = JSON.parse(override.rule_json) as TargetRule;
        } catch {
          rule = null;
        }
        setTargets(rule?.targets?.join(", ") || "");
        setRandomFallback(rule?.random_fallback ?? true);
      } else {
        setUseOverride(false);
        setTargets("");
        setRandomFallback(true);
      }

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

      const bl = await listBlacklist(accountId, action.id);
      if (isCancelled()) return;
      setBlacklistEntries(bl);

      if (action.is_two_step) {
        const p = await listTargetPairs(accountId, action.id);
        if (isCancelled()) return;
        setPairs(p);
      }
    } catch (err) {
      if (!isCancelled()) {
        toastError("Failed to load target data", err);
      }
    }
  };

  const handleSave = async () => {
    if (useDelayOverride) {
      const result = validateDelay(minDelay, maxDelay);
      if (!result.valid) {
        setDelayError(result.error);
        toastError("Invalid delay", result.error);
        return;
      }
    }

    setSaving(true);
    try {
      if (useOverride) {
        const targetList = targets.split(",").map((t) => t.trim()).filter((t) => t);
        const rule: TargetRule = {
          type: action.button_type,
          targets: targetList,
          random_fallback: randomFallback,
        };
        await setTargetOverride(accountId, action.id, JSON.stringify(rule));
      } else {
        await deleteTargetOverride(accountId, action.id);
      }

      if (useDelayOverride) {
        await setDelayOverride(accountId, action.id, minDelay, maxDelay);
      } else {
        await deleteDelayOverride(accountId, action.id);
      }

      queryClient.invalidateQueries({ queryKey: ["targetOverrides", accountId] });
      queryClient.invalidateQueries({ queryKey: ["delayOverrides", accountId] });
      queryClient.invalidateQueries({ queryKey: ["action-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["account-overrides"] });

      onOpenChange(false);
    } catch (err) {
      toastError("Failed to save", err);
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
      toastError("Failed to add blacklist entry", err);
    }
  };

  const handleRemoveBlacklist = async (entryId: number) => {
    try {
      await removeBlacklistEntry(entryId);
      setBlacklistEntries(blacklistEntries.filter((e) => e.id !== entryId));
    } catch (err) {
      toastError("Failed to remove blacklist entry", err);
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
      toastError("Failed to add target pair", err);
    }
  };

  const handleRemovePair = async (pairId: number) => {
    try {
      await removeTargetPair(pairId);
      setPairs(pairs.filter((p) => p.id !== pairId));
    } catch (err) {
      toastError("Failed to remove target pair", err);
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
          <TabsList className={cn("grid w-full gap-2", action.is_two_step ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
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
            <TabsContent value="targets" className="mt-0 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                <Label htmlFor="use-override" className="cursor-pointer">Use custom targets (override default)</Label>
                <Switch id="use-override" checked={useOverride} onCheckedChange={setUseOverride} />
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
                      <p className="text-xs text-muted-foreground">Pick random target if none from list are available</p>
                    </div>
                    <Switch id="random-fallback" checked={randomFallback} onCheckedChange={setRandomFallback} />
                  </div>
                </>
              )}

              {!useOverride && (
                <div className="flex items-start gap-2 rounded-lg bg-muted/60 border border-border px-3 py-2.5">
                  <IconInfoCircle className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Using global default targeting rules for this action.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="delay" className="mt-0 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                <Label htmlFor="use-delay-override" className="cursor-pointer">Use custom delay (override default)</Label>
                <Switch id="use-delay-override" checked={useDelayOverride} onCheckedChange={setUseDelayOverride} />
              </div>

              {useDelayOverride && (
                <div className="space-y-2">
                  <div className="grid gap-4 sm:grid-cols-2">
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
                  {delayError && <p className="text-xs text-destructive">{delayError}</p>}
                </div>
              )}

              {!useDelayOverride && (
                <div className="flex items-start gap-2 rounded-lg bg-muted/60 border border-border px-3 py-2.5">
                  <IconInfoCircle className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Using global default delay (2–8 seconds).
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="blacklist" className="mt-0 space-y-4">
              <div className="flex flex-wrap gap-2">
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
                <div className="flex items-start gap-2 rounded-lg bg-muted/60 border border-border px-3 py-2.5">
                  <IconBan className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">No blacklisted players for this action.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {blacklistEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between px-3 py-2 border rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors">
                      <span className="text-sm font-medium">{entry.button_text}</span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemoveBlacklist(entry.id)}
                        aria-label="Remove blacklist entry"
                        className="hover:text-destructive hover:bg-destructive/10"
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {action.is_two_step && (
              <TabsContent value="pairs" className="mt-0 space-y-4">
                <div className="flex flex-wrap gap-2">
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
                  <div className="flex items-start gap-2 rounded-lg bg-muted/60 border border-border px-3 py-2.5">
                    <IconHeart className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">No pairs configured. Add pairs above or random selection will be used.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {pairs.map((pair, index) => (
                      <div key={pair.id} className="flex items-center justify-between px-3 py-2 border rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors">
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="text-xs h-5 w-5 p-0 flex items-center justify-center">{index + 1}</Badge>
                          <span className="font-medium">{pair.target_a}</span>
                          <IconHeart className="size-3.5 text-pink-500" />
                          <span className="font-medium">{pair.target_b}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRemovePair(pair.id)}
                          aria-label="Remove target pair"
                          className="hover:text-destructive hover:bg-destructive/10"
                        >
                          <IconTrash className="size-4" />
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
