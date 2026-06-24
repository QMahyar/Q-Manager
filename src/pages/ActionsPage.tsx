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
  IconDownload,
  IconUpload,
  IconDotsVertical,
  IconHandClick,
} from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionDialogs } from "@/components/actions/ActionDialogs";
import { toast } from "@/components/ui/sonner";
import { open as openDialog, save as saveDialog } from "@/lib/transport";
import { getTargetDefault, setTargetDefault, getDelayDefault, setDelayDefault, reloadAllPatterns, invokeCommand, exportActionPatterns, importActionPatterns } from "@/lib/api";
import type { Action, ActionCreate, ActionUpdate, ActionPattern, ButtonType } from "@/lib/types";
import { useActionsData } from "@/hooks/useActionsData";
import { useActionPatterns, useActionPatternCounts } from "@/hooks/useActionPatterns";
import { useAccountEvents, RegexValidationEvent } from "@/hooks/useAccountEvents";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { IconBolt } from "@tabler/icons-react";
import { ActionPatternTable } from "@/components/actions/ActionPatternTable";
import { ActionDefaultsDialog } from "@/components/actions/ActionDefaultsDialog";
import { toastError } from "@/lib/toast-utils";

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
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  const [regexIssues, setRegexIssues] = useState<RegexValidationEvent[]>([]);
  const { actionsQuery, deleteMutation: deleteActionMutation } = useActionsData();

  useAccountEvents({
    onRegexValidation: (event) => {
      setRegexIssues((prev) => {
        const next = [event, ...prev];
        return next.slice(0, 10);
      });
    },
  });

  const createActionMutation = useMutation({
    mutationFn: (payload: ActionCreate) => invokeCommand<Action>("action_create", { payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      setAddActionOpen(false);
      resetActionForm();
      toast.success("Action created");
    },
    onError: (e) => toastError("Failed to create action", e),
  });

  const updateActionMutation = useMutation({
    mutationFn: (payload: ActionUpdate) => invokeCommand<Action>("action_update", { payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      setEditActionOpen(false);
      setActionToEdit(null);
      toast.success("Action updated");
    },
    onError: (e) => toastError("Failed to update action", e),
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
        try {
          const rule = JSON.parse(targetDefault.rule_json);
          setDefaultTargets(rule.targets || []);
          setDefaultRandomFallback(rule.random_fallback ?? true);
          setDefaultFixedText(rule.fixed_text || "");
        } catch {
          setDefaultTargets([]);
          setDefaultRandomFallback(true);
          setDefaultFixedText("");
        }
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
      toastError("Failed to save defaults", e);
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
    if (!actionToDelete) return;
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
    <ActionPatternTable
      action={action}
      patterns={patternsToShow}
      stepLabel={stepLabel}
      tableRef={actionsParent}
      onAddPattern={openAddPattern}
      onTogglePattern={(pattern, enabled) =>
        togglePatternMutation.mutate({
          id: pattern.id,
          pattern: pattern.pattern,
          is_regex: pattern.is_regex,
          enabled,
          priority: pattern.priority,
          step: pattern.step,
        })
      }
      onEditPattern={openEditPattern}
      onDeletePattern={(patternId) => deletePatternMutation.mutate({ patternId, actionId: action.id })}
    />
  );

  return (
    <PageTransition className="min-h-screen flex flex-col">
      <PageHeader
        title="Actions"
        description="Define action triggers and button types"
        icon={IconHandClick}
        iconColor="text-emerald-500"
      >
        <div className="flex items-center gap-2">
          {regexIssues.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs cursor-pointer" onClick={() => setRegexIssues([])}>
              <IconBolt className="size-3.5 shrink-0" />
              <span className="font-semibold">{regexIssues.length} regex error{regexIssues.length > 1 ? "s" : ""}</span>
              <span className="text-destructive/60">· click to dismiss</span>
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm"><IconDotsVertical className="size-4" /></Button>} />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={async () => {
                  const path = await saveDialog({ title: "Export action patterns", defaultPath: "action-patterns.json", filters: [{ name: "JSON", extensions: ["json"] }] });
                  if (!path) return;
                  setIsExporting(true);
                  try { await exportActionPatterns(path as string); toast.success("Action patterns exported"); }
                  catch (e) { toastError("Failed to export patterns", e); }
                  finally { setIsExporting(false); }
                }}
                disabled={isExporting}
              >
                <IconDownload className="size-4 mr-2" />
                Export Patterns
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  const path = await openDialog({ title: "Import action patterns", multiple: false, filters: [{ name: "JSON", extensions: ["json"] }] });
                  if (!path) return;
                  setIsImporting(true);
                  try {
                    const result = await importActionPatterns(path as string);
                    toast.success("Action patterns imported", { description: `Imported ${result.imported}, Updated ${result.updated}, Skipped ${result.skipped}.` });
                    if (result.skipped_items?.length) toast.warning("Some patterns were skipped", { description: result.skipped_items.join("; ") });
                    queryClient.invalidateQueries({ queryKey: ["action-patterns"] });
                    await reloadAllPatterns();
                  } catch (e) { toastError("Failed to import patterns", e); }
                  finally { setIsImporting(false); }
                }}
                disabled={isImporting}
              >
                <IconUpload className="size-4 mr-2" />
                Import Patterns
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  setIsReloading(true);
                  try { await reloadAllPatterns(); toast.success("Patterns reloaded", { description: "Running workers will use updated patterns." }); }
                  catch (e) { toastError("Failed to reload patterns", e); }
                  finally { setIsReloading(false); }
                }}
                disabled={isReloading}
              >
                <IconRefresh className={`size-4 mr-2 ${isReloading ? "animate-spin" : ""}`} />
                Reload Workers
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => { resetActionForm(); setAddActionOpen(true); }}>
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
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-md transition-colors ${expandedActionId === action.id ? "bg-primary/10" : "bg-muted/50"}`}>
                        {expandedActionId === action.id ? (
                          <IconChevronDown className="size-4 text-primary" />
                        ) : (
                          <IconChevronRight className="size-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {action.name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {getButtonTypeLabel(action.button_type)}{action.is_two_step ? " · Two-step" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
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
                        className="text-muted-foreground hover:text-sky-500 hover:bg-sky-500/10"
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
                        className="text-muted-foreground hover:text-foreground hover:bg-muted"
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
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {expandedActionId === action.id && (
                  <div>
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
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        <ActionDialogs
          addActionOpen={addActionOpen}
          editActionOpen={editActionOpen}
          deleteActionOpen={deleteActionOpen}
          addPatternOpen={addPatternOpen}
          editPatternOpen={editPatternOpen}
          actionToEdit={actionToEdit}
          actionToDelete={actionToDelete}
          patternToEdit={patternToEdit}
          newActionName={newActionName}
          newButtonType={newButtonType}
          newRandomFallback={newRandomFallback}
          newIsTwoStep={newIsTwoStep}
          newPattern={newPattern}
          newPatternIsRegex={newPatternIsRegex}
          newPatternPriority={newPatternPriority}
          editPatternText={editPatternText}
          editPatternIsRegex={editPatternIsRegex}
          editPatternPriority={editPatternPriority}
          onAddActionChange={setAddActionOpen}
          onEditActionChange={setEditActionOpen}
          onDeleteActionChange={setDeleteActionOpen}
          onAddPatternChange={setAddPatternOpen}
          onEditPatternChange={setEditPatternOpen}
          onUpdateNewActionName={setNewActionName}
          onUpdateNewButtonType={setNewButtonType}
          onUpdateNewRandomFallback={setNewRandomFallback}
          onUpdateNewIsTwoStep={setNewIsTwoStep}
          onUpdateNewPattern={setNewPattern}
          onUpdateNewPatternIsRegex={setNewPatternIsRegex}
          onUpdateNewPatternPriority={setNewPatternPriority}
          onUpdateEditPatternText={setEditPatternText}
          onUpdateEditPatternIsRegex={setEditPatternIsRegex}
          onUpdateEditPatternPriority={setEditPatternPriority}
          onCreateAction={handleAddAction}
          onUpdateAction={handleEditAction}
          onDeleteAction={() => handleDeleteAction()}
          onCreatePattern={handleAddPattern}
          onUpdatePattern={handleEditPattern}
        />

        <ActionDefaultsDialog
          open={defaultsDialogOpen}
          onOpenChange={setDefaultsDialogOpen}
          action={actions.find((a) => a.id === defaultsActionId)}
          defaultsActionName={defaultsActionName}
          defaultFixedText={defaultFixedText}
          defaultTargets={defaultTargets}
          defaultRandomFallback={defaultRandomFallback}
          defaultDelayMin={defaultDelayMin}
          defaultDelayMax={defaultDelayMax}
          newTargetInput={newTargetInput}
          onUpdateFixedText={setDefaultFixedText}
          onUpdateRandomFallback={setDefaultRandomFallback}
          onUpdateDelayMin={setDefaultDelayMin}
          onUpdateDelayMax={setDefaultDelayMax}
          onUpdateNewTargetInput={setNewTargetInput}
          onAddTarget={addDefaultTarget}
          onRemoveTarget={removeDefaultTarget}
          onSave={saveDefaults}
        />
      </main>
    </PageTransition>
  );
}
