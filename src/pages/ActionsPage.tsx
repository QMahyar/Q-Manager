import { useState } from "react";
import { PageTransition } from "@/components/motion/PageTransition";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  IconPlus,
  IconTrash,
  IconPencil,
  IconChevronDown,
  IconChevronRight,
  IconSettings,
  IconRefresh,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "@/components/ui/sonner";
import { getTargetDefault, setTargetDefault, getDelayDefault, setDelayDefault, reloadAllPatterns, invokeCommand } from "@/lib/api";
import type { Action, ActionCreate, ActionUpdate, ActionPattern, ButtonType } from "@/lib/types";
import { useActionsData } from "@/hooks/useActionsData";
import { useActionPatterns, useActionPatternCounts } from "@/hooks/useActionPatterns";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { IconBolt, IconFlask } from "@tabler/icons-react";
import { RegexTestDialog, RegexValidationBadge } from "@/components/RegexTestDialog";
import { HelpTooltip, helpContent } from "@/components/HelpTooltip";
import { RegexHelpDialog } from "@/components/RegexHelpDialog";
import { validateDisplayName } from "@/lib/validation";
import { getErrorMessage } from "@/lib/error-utils";

// ActionPattern type is now imported from @/lib/types

export default function ActionsPage() {
  const queryClient = useQueryClient();
  const [expandedActionId, setExpandedActionId] = useState<number | null>(null);
  
  // AutoAnimate for action list
  const [actionsParent] = useAutoAnimate();
  const [addActionOpen, setAddActionOpen] = useState(false);
  const [editActionOpen, setEditActionOpen] = useState(false);
  const [deleteActionOpen, setDeleteActionOpen] = useState(false);
  const [actionToEdit, setActionToEdit] = useState<Action | null>(null);
  const [actionToDelete, setActionToDelete] = useState<Action | null>(null);
  
  // Pattern dialogs
  const [addPatternOpen, setAddPatternOpen] = useState(false);
  const [patternActionId, setPatternActionId] = useState<number>(0);
  const [patternStep, setPatternStep] = useState<number>(0);
  
  // New action form state
  const [newActionName, setNewActionName] = useState("");
  const [newButtonType, setNewButtonType] = useState<ButtonType>("player_list");
  const [newRandomFallback, setNewRandomFallback] = useState(true);
  const [newIsTwoStep, setNewIsTwoStep] = useState(false);
  
  // Global defaults dialog state
  const [defaultsDialogOpen, setDefaultsDialogOpen] = useState(false);
  const [defaultsActionId, setDefaultsActionId] = useState<number>(0);
  const [defaultsActionName, setDefaultsActionName] = useState("");
  const [defaultFixedText, setDefaultFixedText] = useState("");
  const [defaultTargets, setDefaultTargets] = useState<string[]>([]);
  const [defaultRandomFallback, setDefaultRandomFallback] = useState(true);
  const [defaultDelayMin, setDefaultDelayMin] = useState(2);
  const [defaultDelayMax, setDefaultDelayMax] = useState(8);
  const [newTargetInput, setNewTargetInput] = useState("");
  
  // New pattern form state
  const [newPattern, setNewPattern] = useState("");
  const [newPatternIsRegex, setNewPatternIsRegex] = useState(false);
  const [newPatternPriority, setNewPatternPriority] = useState(0);
  
  // Edit pattern dialog state
  const [editPatternOpen, setEditPatternOpen] = useState(false);
  const [patternToEdit, setPatternToEdit] = useState<ActionPattern | null>(null);
  const [editPatternText, setEditPatternText] = useState("");
  const [editPatternIsRegex, setEditPatternIsRegex] = useState(false);
  const [editPatternPriority, setEditPatternPriority] = useState(0);
  const [isReloading, setIsReloading] = useState(false);
  
  // Validation errors
  const [actionErrors, setActionErrors] = useState<{ name?: string }>({});

  const { actionsQuery, deleteMutation: deleteActionMutation } = useActionsData();

  const createActionMutation = useMutation({
    mutationFn: (payload: ActionCreate) => invokeCommand<Action>("action_create", { payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      setAddActionOpen(false);
      resetActionForm();
      toast.success("Action created");
    },
    onError: (e) => toast.error("Failed to create action", { description: getErrorMessage(e) }),
  });

  const updateActionMutation = useMutation({
    mutationFn: (payload: ActionUpdate) => invokeCommand<Action>("action_update", { payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      setEditActionOpen(false);
      setActionToEdit(null);
      toast.success("Action updated");
    },
    onError: (e) => toast.error("Failed to update action", { description: getErrorMessage(e) }),
  });
  const actions = actionsQuery.data ?? [];
  const isLoading = actionsQuery.isLoading;

  const { patternsQuery, createMutation, updateMutation, deleteMutation } = useActionPatterns(expandedActionId);
  const patterns = patternsQuery.data ?? [];

  const { data: patternCounts = {} } = useActionPatternCounts(actions.map((action) => action.id));

  // Open defaults dialog
  const openDefaultsDialog = async (action: Action) => {
    setDefaultsActionId(action.id);
    setDefaultsActionName(action.name);
    setDefaultFixedText("");

    // Fetch current defaults
    try {
      const targetDefault = await getTargetDefault(action.id);
      if (targetDefault?.rule_json) {
        const rule = JSON.parse(targetDefault.rule_json);
        setDefaultTargets(rule.targets || []);
        setDefaultRandomFallback(rule.random_fallback ?? true);
        setDefaultFixedText(rule.fixed_text || "");
      } else {
        setDefaultTargets([]);
        setDefaultRandomFallback(true);
        setDefaultFixedText("");
      }
    } catch {
      setDefaultTargets([]);
      setDefaultRandomFallback(true);
      setDefaultFixedText("");
    }
    
    try {
      const delayDefault = await getDelayDefault(action.id);
      setDefaultDelayMin(delayDefault?.min_seconds ?? 2);
      setDefaultDelayMax(delayDefault?.max_seconds ?? 8);
    } catch {
      setDefaultDelayMin(2);
      setDefaultDelayMax(8);
    }
    
    setNewTargetInput("");
    setDefaultsDialogOpen(true);
  };
  
  // Save defaults
  const saveDefaults = async () => {
    try {
      const action = actions.find((a) => a.id === defaultsActionId);
      const buttonType = action?.button_type ?? "player_list";
      const ruleJson = JSON.stringify(
        buttonType === "player_list"
          ? {
              type: "player_list",
              targets: defaultTargets,
              random_fallback: defaultRandomFallback,
            }
          : {
              type: buttonType,
              fixed_text: defaultFixedText.trim(),
              random_fallback: defaultRandomFallback,
            }
      );
      await setTargetDefault(defaultsActionId, ruleJson);
      await setDelayDefault(defaultsActionId, defaultDelayMin, defaultDelayMax);
      toast.success("Defaults saved");
      setDefaultsDialogOpen(false);
    } catch (e) {
      toast.error("Failed to save defaults", { description: getErrorMessage(e) });
    }
  };
  
  // Add target to defaults list
  const addDefaultTarget = () => {
    if (newTargetInput.trim() && !defaultTargets.includes(newTargetInput.trim())) {
      setDefaultTargets([...defaultTargets, newTargetInput.trim()]);
      setNewTargetInput("");
    }
  };
  
  // Remove target from defaults list
  const removeDefaultTarget = (target: string) => {
    setDefaultTargets(defaultTargets.filter(t => t !== target));
  };

  const createPatternMutation = createMutation;
  const deletePatternMutation = deleteMutation;
  const togglePatternMutation = updateMutation;

  const resetActionForm = () => {
    setNewActionName("");
    setNewButtonType("player_list");
    setNewRandomFallback(true);
    setNewIsTwoStep(false);
  };
  
  const resetPatternForm = () => {
    setNewPattern("");
    setNewPatternIsRegex(false);
    setNewPatternPriority(0);
    setPatternStep(0);
  };

  const handleAddAction = () => {
    if (newActionName.trim()) {
      createActionMutation.mutate(
        {
          name: newActionName.trim(),
          button_type: newButtonType,
          random_fallback_enabled: newRandomFallback,
          is_two_step: newIsTwoStep,
        },
        {
          onSuccess: () => {
            setAddActionOpen(false);
            resetActionForm();
          },
        }
      );
    }
  };

  const handleEditAction = () => {
    if (actionToEdit && newActionName.trim()) {
      updateActionMutation.mutate({
        id: actionToEdit.id,
        name: newActionName.trim(),
        button_type: newButtonType,
        random_fallback_enabled: newRandomFallback,
        is_two_step: newIsTwoStep,
      });
    }
  };

  const handleDeleteAction = () => {
    if (actionToDelete) {
      deleteActionMutation.mutate(actionToDelete.id, {
        onSuccess: () => {
          if (expandedActionId === actionToDelete.id) {
            setExpandedActionId(null);
          }
        },
        onSettled: () => {
          setDeleteActionOpen(false);
          setActionToDelete(null);
        },
      });
    }
  };
  
  const handleAddPattern = () => {
    if (newPattern.trim() && patternActionId > 0) {
      createPatternMutation.mutate({
        action_id: patternActionId,
        pattern: newPattern.trim(),
        is_regex: newPatternIsRegex,
        enabled: true,
        priority: newPatternPriority,
        step: patternStep,
      });
    }
  };
  
  const openEditAction = (action: Action) => {
    setActionToEdit(action);
    setNewActionName(action.name);
    setNewButtonType(action.button_type);
    setNewRandomFallback(action.random_fallback_enabled);
    setNewIsTwoStep(action.is_two_step);
    setEditActionOpen(true);
  };
  
  const openAddPattern = (actionId: number, step: number = 0) => {
    setPatternActionId(actionId);
    setPatternStep(step);
    resetPatternForm();
    setAddPatternOpen(true);
  };
  
  const openEditPattern = (pattern: ActionPattern) => {
    setPatternToEdit(pattern);
    setEditPatternText(pattern.pattern);
    setEditPatternIsRegex(pattern.is_regex);
    setEditPatternPriority(pattern.priority);
    setEditPatternOpen(true);
  };
  
  const handleEditPattern = () => {
    if (patternToEdit && editPatternText.trim()) {
      togglePatternMutation.mutate({
        id: patternToEdit.id,
        pattern: editPatternText.trim(),
        is_regex: editPatternIsRegex,
        enabled: patternToEdit.enabled,
        priority: editPatternPriority,
        step: patternToEdit.step,
      });
      setEditPatternOpen(false);
      setPatternToEdit(null);
    }
  };

  const getButtonTypeLabel = (type: ButtonType): string => {
    const labels: Record<ButtonType, string> = {
      player_list: "Player List",
      yes_no: "Yes/No",
      fixed: "Fixed Button",
    };
    return labels[type] || type;
  };

  const getButtonTypeBadgeVariant = (type: ButtonType): "default" | "secondary" | "outline" => {
    const variants: Record<ButtonType, "default" | "secondary" | "outline"> = {
      player_list: "default",
      yes_no: "secondary",
      fixed: "outline",
    };
    return variants[type] || "outline";
  };
  
  const renderPatternTable = (action: Action, patternsToShow: ActionPattern[], stepLabel?: string) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-medium">{stepLabel || "Trigger Patterns"}</h5>
        <Button
          size="sm"
          variant="outline"
          onClick={() => openAddPattern(action.id, stepLabel === "Trigger A (First Prompt)" ? 1 : stepLabel === "Trigger B (Second Prompt)" ? 2 : 0)}
        >
          <IconPlus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>
      {patternsToShow.length === 0 ? (
        <p className="text-sm text-muted-foreground bg-muted/50 rounded p-3">
          No patterns configured yet.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pattern</TableHead>
              <TableHead className="w-20">Type</TableHead>
              <TableHead className="w-20">Priority</TableHead>
              <TableHead className="w-20">Enabled</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody ref={actionsParent}>
            {patternsToShow.sort((a, b) => b.priority - a.priority).map((pattern) => (
              <TableRow key={pattern.id}>
                <TableCell className="font-mono text-sm">{pattern.pattern}</TableCell>
                <TableCell>
                  <Badge variant={pattern.is_regex ? "default" : "secondary"} className="text-xs">
                    {pattern.is_regex ? "Regex" : "Text"}
                  </Badge>
                </TableCell>
                <TableCell>{pattern.priority}</TableCell>
                <TableCell>
                  <Switch
                    checked={pattern.enabled}
                    onCheckedChange={(enabled) => togglePatternMutation.mutate({
                      id: pattern.id,
                      pattern: pattern.pattern,
                      is_regex: pattern.is_regex,
                      enabled,
                      priority: pattern.priority,
                      step: pattern.step,
                    })}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <RegexTestDialog
                      pattern={pattern.pattern}
                      isRegex={pattern.is_regex}
                      trigger={
                        <Button variant="ghost" size="icon-sm" title="Test pattern" aria-label="Test pattern">
                          <IconFlask className="size-4" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Edit Pattern"
                      aria-label="Edit pattern"
                      onClick={() => openEditPattern(pattern)}
                    >
                      <IconPencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Delete Pattern"
                      aria-label="Delete pattern"
                      onClick={() => deletePatternMutation.mutate(pattern.id)}
                    >
                      <IconTrash className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );

  return (
    <PageTransition className="min-h-screen flex flex-col">
      <PageHeader
        title="Actions"
        description="Define action triggers and button types"
      >
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              setIsReloading(true);
              try {
                await reloadAllPatterns();
                toast.success("Patterns reloaded", {
                  description: "Running workers will now use the updated patterns.",
                });
              } catch (e) {
                toast.error("Failed to reload patterns", { description: getErrorMessage(e) });
              } finally {
                setIsReloading(false);
              }
            }}
            disabled={isReloading}
          >
            <IconRefresh className={`size-4 mr-2 ${isReloading ? "animate-spin" : ""}`} />
            Reload
          </Button>
          <Button onClick={() => { resetActionForm(); setAddActionOpen(true); }}>
            <IconPlus className="size-4 mr-1" />
            Add Action
          </Button>
        </div>
      </PageHeader>

      <main className="flex-1 p-6 w-full max-w-6xl mx-auto">
        {isLoading ? (
          <CardSkeleton count={4} />
        ) : actions.length === 0 ? (
          <EmptyState
            icon={<IconBolt className="h-8 w-8 text-muted-foreground" />}
            title="No actions configured"
            description="Create actions to define how the bot responds to game prompts."
            action={{ label: "Add Action", onClick: () => { resetActionForm(); setAddActionOpen(true); } }}
          />
        ) : (
          <div className="space-y-4">
            {actions.map((action) => (
              <Card key={action.id}>
                <CardHeader
                  className="cursor-pointer"
                  onClick={() =>
                    setExpandedActionId(
                      expandedActionId === action.id ? null : action.id
                    )
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {expandedActionId === action.id ? (
                        <IconChevronDown className="size-4 text-muted-foreground" />
                      ) : (
                        <IconChevronRight className="size-4 text-muted-foreground" />
                      )}
                      <div>
                        <CardTitle className="text-base">
                          {action.name}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground font-mono">
                          {action.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getButtonTypeBadgeVariant(action.button_type)}>
                        {getButtonTypeLabel(action.button_type)}
                      </Badge>
                      {action.is_two_step && (
                        <Badge variant="outline">Two-Step</Badge>
                      )}
                      {action.random_fallback_enabled && (
                        <Badge variant="secondary">Random</Badge>
                      )}
                      <Badge variant="outline" className="font-normal">
                        {patternCounts[action.id] ?? 0} pattern{(patternCounts[action.id] ?? 0) !== 1 ? "s" : ""}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Configure Defaults"
                        aria-label="Configure defaults"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDefaultsDialog(action);
                        }}
                      >
                        <IconSettings className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Edit Action"
                        aria-label="Edit action"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditAction(action);
                        }}
                      >
                        <IconPencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Delete Action"
                        aria-label="Delete action"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionToDelete(action);
                          setDeleteActionOpen(true);
                        }}
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {expandedActionId === action.id && (
                  <CardContent>
                    <div className="border-t pt-4 space-y-6">
                      {action.is_two_step ? (
                        <>
                          {renderPatternTable(
                            action,
                            patterns.filter(p => p.step === 1),
                            "Trigger A (First Prompt)"
                          )}
                          {renderPatternTable(
                            action,
                            patterns.filter(p => p.step === 2),
                            "Trigger B (Second Prompt)"
                          )}
                        </>
                      ) : (
                        renderPatternTable(action, patterns.filter(p => p.step === 0))
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Add Action Dialog */}
        <Dialog open={addActionOpen} onOpenChange={setAddActionOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Action</DialogTitle>
              <DialogDescription>
                Create a new action definition with trigger patterns.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="displayName">Action Name</Label>
                <Input
                  id="displayName"
                  value={newActionName}
                  onChange={(e) => {
                    setNewActionName(e.target.value);
                    const result = validateDisplayName(e.target.value);
                    setActionErrors(prev => ({ ...prev, name: result.error }));
                  }}
                  placeholder="Vote for Execution"
                  className={actionErrors.name ? "border-destructive" : ""}
                />
                {actionErrors.name && (
                  <p className="text-xs text-destructive">{actionErrors.name}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Button Type</Label>
                <div className="flex gap-2">
                  {(["player_list", "yes_no", "fixed"] as ButtonType[]).map((type) => (
                    <Button
                      key={type}
                      variant={newButtonType === type ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNewButtonType(type)}
                    >
                      {getButtonTypeLabel(type)}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Random Fallback</Label>
                  <p className="text-xs text-muted-foreground">
                    Pick random if no target matches
                  </p>
                </div>
                <Switch checked={newRandomFallback} onCheckedChange={setNewRandomFallback} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Two-Step Action</Label>
                  <p className="text-xs text-muted-foreground">
                    Requires two sequential selections (e.g., Cupid)
                  </p>
                </div>
                <Switch checked={newIsTwoStep} onCheckedChange={setNewIsTwoStep} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddActionOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddAction} 
                disabled={!newActionName.trim() || !!actionErrors.name}
              >
                Add Action
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Action Dialog */}
        <Dialog open={editActionOpen} onOpenChange={setEditActionOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Action</DialogTitle>
              <DialogDescription>
                Modify the action settings.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="editDisplayName">Action Name</Label>
                <Input
                  id="editDisplayName"
                  value={newActionName}
                  onChange={(e) => {
                    setNewActionName(e.target.value);
                    const result = validateDisplayName(e.target.value);
                    setActionErrors(prev => ({ ...prev, name: result.error }));
                  }}
                  className={actionErrors.name ? "border-destructive" : ""}
                />
                {actionErrors.name && (
                  <p className="text-xs text-destructive">{actionErrors.name}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editName">Action Name</Label>
                <Input
                  id="editName"
                  value={newActionName}
                  onChange={(e) => {
                    setNewActionName(e.target.value);
                    const result = validateDisplayName(e.target.value);
                    setActionErrors(prev => ({ ...prev, name: result.error }));
                  }}
                  className={actionErrors.name ? "border-destructive" : ""}
                />
                {actionErrors.name && (
                  <p className="text-xs text-destructive">{actionErrors.name}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Button Type</Label>
                <div className="flex gap-2">
                  {(["player_list", "yes_no", "fixed"] as ButtonType[]).map((type) => (
                    <Button
                      key={type}
                      variant={newButtonType === type ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNewButtonType(type)}
                    >
                      {getButtonTypeLabel(type)}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Random Fallback</Label>
                <Switch checked={newRandomFallback} onCheckedChange={setNewRandomFallback} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Two-Step Action</Label>
                <Switch checked={newIsTwoStep} onCheckedChange={setNewIsTwoStep} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditActionOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditAction}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Action Dialog */}
        <Dialog open={deleteActionOpen} onOpenChange={setDeleteActionOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Action</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{actionToDelete?.name}"?
                This will also delete all associated patterns and target rules.
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteActionOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteAction} disabled={deleteActionMutation.isPending}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Pattern Dialog */}
        <Dialog open={addPatternOpen} onOpenChange={setAddPatternOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Pattern</DialogTitle>
              <DialogDescription>
                Add a new trigger pattern for this action.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pattern">Pattern</Label>
                  <RegexValidationBadge pattern={newPattern} isRegex={newPatternIsRegex} />
                </div>
                <div className="flex gap-2">
                  <Input
                    id="pattern"
                    value={newPattern}
                    onChange={(e) => setNewPattern(e.target.value)}
                    placeholder="Enter pattern text or regex..."
                    className="font-mono flex-1"
                  />
                  <RegexTestDialog
                    pattern={newPattern}
                    isRegex={newPatternIsRegex}
                    onPatternChange={setNewPattern}
                    onIsRegexChange={setNewPatternIsRegex}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1">
                    <Label>Use Regex</Label>
                    <HelpTooltip content={helpContent.regex} />
                    <RegexHelpDialog trigger={<Button variant="ghost" size="icon-sm" aria-label="Regex help">?</Button>} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enable regular expression matching
                  </p>
                </div>
                <Switch checked={newPatternIsRegex} onCheckedChange={setNewPatternIsRegex} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  value={newPatternPriority}
                  onChange={(e) => setNewPatternPriority(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Lower numbers = higher priority
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddPatternOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddPattern} 
                disabled={!newPattern.trim() || (newPatternIsRegex && (() => { try { new RegExp(newPattern); return false; } catch { return true; } })())}
              >
                Add Pattern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Pattern Dialog */}
        <Dialog open={editPatternOpen} onOpenChange={setEditPatternOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Pattern</DialogTitle>
              <DialogDescription>
                Modify the trigger pattern settings.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="editPattern">Pattern</Label>
                  <RegexValidationBadge pattern={editPatternText} isRegex={editPatternIsRegex} />
                </div>
                <div className="flex gap-2">
                  <Input
                    id="editPattern"
                    value={editPatternText}
                    onChange={(e) => setEditPatternText(e.target.value)}
                    placeholder="Enter pattern text or regex..."
                    className="font-mono flex-1"
                  />
                  <RegexTestDialog
                    pattern={editPatternText}
                    isRegex={editPatternIsRegex}
                    onPatternChange={setEditPatternText}
                    onIsRegexChange={setEditPatternIsRegex}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1">
                    <Label>Use Regex</Label>
                    <HelpTooltip content={helpContent.regex} />
                    <RegexHelpDialog trigger={<Button variant="ghost" size="icon-sm" aria-label="Regex help">?</Button>} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enable regular expression matching
                  </p>
                </div>
                <Switch checked={editPatternIsRegex} onCheckedChange={setEditPatternIsRegex} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editPriority">Priority</Label>
                <Input
                  id="editPriority"
                  type="number"
                  value={editPatternPriority}
                  onChange={(e) => setEditPatternPriority(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Lower numbers = higher priority
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditPatternOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleEditPattern} 
                disabled={!editPatternText.trim() || (editPatternIsRegex && (() => { try { new RegExp(editPatternText); return false; } catch { return true; } })())}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Configure Defaults Dialog */}
        <Dialog open={defaultsDialogOpen} onOpenChange={setDefaultsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Configure Defaults</DialogTitle>
              <DialogDescription>
                Set global default targets and delays for "{defaultsActionName}".
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {actions.find((a) => a.id === defaultsActionId)?.button_type === "player_list" ? (
                <>
                  <div className="grid gap-2">
                    <Label>Default Targets (priority order)</Label>
                    <div className="flex gap-2">
                      <Input
                        value={newTargetInput}
                        onChange={(e) => setNewTargetInput(e.target.value)}
                        placeholder="Add target name..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addDefaultTarget();
                          }
                        }}
                      />
                      <Button type="button" onClick={addDefaultTarget} disabled={!newTargetInput.trim()}>
                        <IconPlus className="size-4" />
                      </Button>
                    </div>
                    {defaultTargets.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {defaultTargets.map((target, idx) => (
                          <Badge key={idx} variant="secondary" className="gap-1">
                            {target}
                            <button
                              type="button"
                              onClick={() => removeDefaultTarget(target)}
                              className="ml-1 hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Players will be targeted in this order
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Random Fallback</Label>
                      <p className="text-xs text-muted-foreground">
                        Pick random if no target matches
                      </p>
                    </div>
                    <Switch
                      checked={defaultRandomFallback}
                      onCheckedChange={setDefaultRandomFallback}
                    />
                  </div>
                </>
              ) : (
                <div className="grid gap-2">
                  <Label>Default Button Text</Label>
                  <Input
                    value={defaultFixedText}
                    onChange={(e) => setDefaultFixedText(e.target.value)}
                    placeholder="Enter exact button text..."
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the exact button text to click for this action.
                  </p>
                </div>
              )}

              <div className="grid gap-2">
                <Label>Default Delay (seconds)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Min</Label>
                    <Input
                      type="number"
                      min={0}
                      value={defaultDelayMin}
                      onChange={(e) => setDefaultDelayMin(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Max</Label>
                    <Input
                      type="number"
                      min={0}
                      value={defaultDelayMax}
                      onChange={(e) => setDefaultDelayMax(Number(e.target.value))}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Random delay between min and max before clicking
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDefaultsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveDefaults}>
                Save Defaults
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </PageTransition>
  );
}
