import { useState } from "react";
import { PageTransition } from "@/components/motion/PageTransition";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import {
  IconPlus,
  IconTrash,
  IconPencil,
  IconRefresh,
  IconFlask,
  IconDownload,
  IconUpload,
  IconClipboardList,
  IconDotsVertical,
  IconListCheck,
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { PhasePatternDialogs } from "@/components/phases/PhasePatternDialogs";
import { open as openDialog, save as saveDialog } from "@/lib/transport";
import {
  listPhases,
  listPhasePatterns,
  createPhasePattern,
  deletePhasePattern,
  updatePhasePattern,
  updatePhasePriority,
  reloadAllPatterns,
  exportPhasePatterns,
  importPhasePatterns,
} from "@/lib/api";
import type { PhasePattern } from "@/lib/types";
import { toast } from "@/components/ui/sonner";
import { RegexTestDialog, RegexValidationBadge } from "@/components/RegexTestDialog";
import { useAccountEvents, RegexValidationEvent } from "@/hooks/useAccountEvents";
import { toastError } from "@/lib/toast-utils";
import { EmptyState } from "@/components/EmptyState";

export default function PhaseDetectionPage() {
  const queryClient = useQueryClient();
  const [selectedPhaseId, setSelectedPhaseId] = useState<number>(1);
  const [addPatternOpen, setAddPatternOpen] = useState(false);
  const [newPattern, setNewPattern] = useState("");
  const [isRegex, setIsRegex] = useState(false);
  const [priority, setPriority] = useState(0);
  const [patternToDelete, setPatternToDelete] = useState<PhasePattern | null>(null);
  
  // Edit pattern state
  const [editPatternOpen, setEditPatternOpen] = useState(false);
  const [patternToEdit, setPatternToEdit] = useState<PhasePattern | null>(null);
  const [editPattern, setEditPattern] = useState("");
  const [editIsRegex, setEditIsRegex] = useState(false);
  const [editPriority, setEditPriority] = useState(0);
  const [editPhaseOpen, setEditPhaseOpen] = useState(false);
  const [phasePriority, setPhasePriority] = useState(0);
  const [isReloading, setIsReloading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  // AutoAnimate for pattern list
  const [patternsParent] = useAutoAnimate();
  const [regexIssues, setRegexIssues] = useState<RegexValidationEvent[]>([]);

  useAccountEvents({
    onRegexValidation: (event) => {
      setRegexIssues((prev) => {
        const next = [event, ...prev];
        return next.slice(0, 10);
      });
    },
  });

  // Fetch phases
  const { data: phases = [] } = useQuery({
    queryKey: ["phases"],
    queryFn: listPhases,
  });

  // Fetch patterns for selected phase
  const { data: patterns = [], isLoading: patternsLoading } = useQuery({
    queryKey: ["phase-patterns", selectedPhaseId],
    queryFn: () => listPhasePatterns(selectedPhaseId),
    enabled: selectedPhaseId > 0,
  });

  // Create pattern mutation
  const createPatternMutation = useMutation({
    mutationFn: createPhasePattern,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phase-patterns", selectedPhaseId] });
      setAddPatternOpen(false);
      setNewPattern("");
      setIsRegex(false);
      setPriority(0);
    },
  });

  // Delete pattern mutation
  const deletePatternMutation = useMutation({
    mutationFn: deletePhasePattern,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phase-patterns", selectedPhaseId] });
      toast.success("Pattern deleted");
    },
    onError: (e) => toastError("Failed to delete pattern", e),
  });

  // Update pattern mutation (for edit and toggle)
  const updatePatternMutation = useMutation({
    mutationFn: updatePhasePattern,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phase-patterns", selectedPhaseId] });
      setEditPatternOpen(false);
      setPatternToEdit(null);
      toast.success("Pattern updated");
    },
    onError: (e) => toastError("Failed to update pattern", e),
  });

  const handleAddPattern = () => {
    if (newPattern.trim()) {
      createPatternMutation.mutate({
        phase_id: selectedPhaseId,
        pattern: newPattern.trim(),
        is_regex: isRegex,
        enabled: true,
        priority: priority,
      });
    }
  };

  const handleDeletePattern = () => {
    if (patternToDelete) {
      deletePatternMutation.mutate(patternToDelete.id, {
        onSettled: () => {
          setPatternToDelete(null);
        },
      });
    }
  };

  const openEditPattern = (pattern: PhasePattern) => {
    setPatternToEdit(pattern);
    setEditPattern(pattern.pattern);
    setEditIsRegex(pattern.is_regex);
    setEditPriority(pattern.priority);
    setEditPatternOpen(true);
  };

  const openEditPhasePriority = (priorityValue: number) => {
    setPhasePriority(priorityValue);
    setEditPhaseOpen(true);
  };

  const handleEditPattern = () => {
    if (patternToEdit && editPattern.trim()) {
      updatePatternMutation.mutate({
        id: patternToEdit.id,
        pattern: editPattern.trim(),
        is_regex: editIsRegex,
        enabled: patternToEdit.enabled,
        priority: editPriority,
      });
    }
  };

  const handleTogglePattern = (pattern: PhasePattern) => {
    updatePatternMutation.mutate({
      id: pattern.id,
      pattern: pattern.pattern,
      is_regex: pattern.is_regex,
      enabled: !pattern.enabled,
      priority: pattern.priority,
    });
  };

  const updatePhasePriorityMutation = useMutation({
    mutationFn: updatePhasePriority,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phases"] });
      setEditPhaseOpen(false);
      toast.success("Phase priority updated");
    },
    onError: (e) => toastError("Failed to update phase priority", e),
  });

  const handleUpdatePhasePriority = () => {
    if (!selectedPhaseId) {
      return;
    }

    updatePhasePriorityMutation.mutate({
      phaseId: selectedPhaseId,
      priority: phasePriority,
    });
  };

  const handleReloadPatterns = async () => {
    setIsReloading(true);
    try {
      await reloadAllPatterns();
      toast.success("Patterns reloaded", {
        description: "Running workers will now use the updated patterns.",
      });
    } catch (e) {
      toastError("Failed to reload patterns", e);
    } finally {
      setIsReloading(false);
    }
  };

  const getPhaseDescription = (name: string): string => {
    const descriptions: Record<string, string> = {
      join_time: "Detects when a new game is starting and join links are available",
      join_confirmation: "Detects confirmation messages from the moderator bot in PM",
      game_start: "Detects when the game has officially started in the group",
      game_end: "Detects when the game has ended in the group",
    };
    return descriptions[name] || "";
  };

  return (
    <PageTransition className="min-h-screen flex flex-col">
      <PageHeader
        title="Phase Detection"
        description="Configure patterns to detect game phases"
        icon={IconListCheck}
        iconColor="text-violet-500"
      >
        <div className="flex items-center gap-2">
          {regexIssues.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs cursor-pointer" onClick={() => setRegexIssues([])}>
              <IconFlask className="size-3.5 shrink-0" />
              <span className="font-semibold">{regexIssues.length} regex error{regexIssues.length > 1 ? "s" : ""}</span>
              <span className="text-destructive/60">· click to dismiss</span>
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm"><IconDotsVertical className="size-4" /></Button>} />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={async () => {
                  const path = await saveDialog({ title: "Export phase patterns", defaultPath: "phase-patterns.json", filters: [{ name: "JSON", extensions: ["json"] }] });
                  if (!path) return;
                  setIsExporting(true);
                  try { await exportPhasePatterns(path as string); toast.success("Phase patterns exported"); }
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
                  const path = await openDialog({ title: "Import phase patterns", multiple: false, filters: [{ name: "JSON", extensions: ["json"] }] });
                  if (!path) return;
                  setIsImporting(true);
                  try {
                    const result = await importPhasePatterns(path as string);
                    toast.success("Phase patterns imported", { description: `Imported ${result.imported}, Updated ${result.updated}, Skipped ${result.skipped}.` });
                    if (result.skipped_items?.length) toast.warning("Some patterns were skipped", { description: result.skipped_items.join("; ") });
                    queryClient.invalidateQueries({ queryKey: ["phase-patterns"], exact: false });
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
              <DropdownMenuItem onClick={handleReloadPatterns} disabled={isReloading}>
                <IconRefresh className={`size-4 mr-2 ${isReloading ? "animate-spin" : ""}`} />
                Reload Workers
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => setAddPatternOpen(true)}>
            <IconPlus className="size-4 mr-1" />
            Add Pattern
          </Button>
        </div>
      </PageHeader>
      <main className="flex-1 p-6 w-full max-w-6xl mx-auto">
        <Tabs
          value={String(selectedPhaseId)}
          onValueChange={(v) => setSelectedPhaseId(Number(v))}
        >
          <TabsList className="mb-4 flex-wrap">
            {phases.map((phase) => (
              <TabsTrigger key={phase.id} value={String(phase.id)}>
                {phase.display_name}
              </TabsTrigger>
            ))}
          </TabsList>

          {phases.map((phase) => (
            <TabsContent key={phase.id} value={String(phase.id)}>
              <div className="space-y-4">
                {/* Phase Info */}
                <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-lg bg-violet-500/10 shrink-0 mt-0.5">
                        <IconListCheck className="size-4 text-violet-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-foreground">{phase.display_name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                          {getPhaseDescription(phase.name)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs border-violet-500/30 text-violet-600 dark:text-violet-400 bg-violet-500/5">
                        Priority {phase.priority}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditPhasePriority(phase.priority)}
                        className="h-7 text-xs border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400"
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Patterns Header — merged into one compact row */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    {patterns.length} pattern{patterns.length !== 1 ? "s" : ""}
                  </span>
                  <Button size="sm" onClick={() => setAddPatternOpen(true)}>
                    <IconPlus className="size-4 mr-1" />
                    Add Pattern
                  </Button>
                </div>

                {/* Patterns Table */}
                {patternsLoading ? (
                  <div className="border rounded-lg p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                    <IconRefresh className="size-5 animate-spin opacity-40" />
                    <span className="text-sm">Loading patterns...</span>
                  </div>
                ) : patterns.length === 0 ? (
                  <EmptyState
                    title="No patterns configured"
                    description="Click Add Pattern to create one for this phase."
                    icon={<IconClipboardList className="h-8 w-8 text-muted-foreground" />}
                  />
                ) : (
                  <div className="rounded-lg border border-border/70 bg-card/70 shadow-sm overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead>Pattern</TableHead>
                          <TableHead className="w-28">Type</TableHead>
                          <TableHead className="w-20">Priority</TableHead>
                          <TableHead className="w-20">Enabled</TableHead>
                          <TableHead className="w-28 text-right pr-4">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody ref={patternsParent}>
                        {patterns
                          .sort((a, b) => b.priority - a.priority)
                          .map((pattern, index) => (
                            <TableRow
                              key={pattern.id}
                              className={`${!pattern.enabled ? "opacity-50" : ""} ${
                                index % 2 === 0 ? "hover:bg-muted/20" : "bg-muted/10 hover:bg-muted/25"
                              }`}
                            >
                              <TableCell className="font-mono text-xs bg-muted/20 max-w-xs truncate">
                                {pattern.pattern}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant={pattern.is_regex ? "default" : "secondary"}>
                                    {pattern.is_regex ? "Regex" : "Text"}
                                  </Badge>
                                  <RegexValidationBadge pattern={pattern.pattern} isRegex={pattern.is_regex} />
                                </div>
                              </TableCell>
                              <TableCell>{pattern.priority}</TableCell>
                              <TableCell>
                                <Switch
                                  checked={pattern.enabled}
                                  onCheckedChange={() => handleTogglePattern(pattern)}
                                />
                              </TableCell>
                              <TableCell className="text-right pr-4">
                                <div className="flex items-center justify-end gap-0.5">
                                  <RegexTestDialog
                                    pattern={pattern.pattern}
                                    isRegex={pattern.is_regex}
                                    trigger={
                                      <Button variant="ghost" size="icon-sm" title="Test pattern" aria-label="Test pattern" className="text-muted-foreground hover:text-violet-500 hover:bg-violet-500/10">
                                        <IconFlask className="size-4" />
                                      </Button>
                                    }
                                  />
                                  <Button 
                                    variant="ghost" 
                                    size="icon-sm"
                                    title="Edit pattern"
                                    aria-label="Edit pattern"
                                    onClick={() => openEditPattern(pattern)}
                                    className="text-muted-foreground hover:text-foreground hover:bg-muted"
                                  >
                                    <IconPencil className="size-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    title="Delete pattern"
                                    aria-label="Delete pattern"
                                    onClick={() => {
                                      setPatternToDelete(pattern);
                                    }}
                                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <IconTrash className="size-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <PhasePatternDialogs
          addPatternOpen={addPatternOpen}
          editPatternOpen={editPatternOpen}
          patternToDelete={patternToDelete}
          patternToEdit={patternToEdit}
          newPattern={newPattern}
          isRegex={isRegex}
          priority={priority}
          editPattern={editPattern}
          editIsRegex={editIsRegex}
          editPriority={editPriority}
          onAddPatternChange={setAddPatternOpen}
          onEditPatternChange={setEditPatternOpen}
          onDeletePatternChange={setPatternToDelete}
          onUpdateNewPattern={setNewPattern}
          onUpdateIsRegex={setIsRegex}
          onUpdatePriority={setPriority}
          onUpdateEditPattern={setEditPattern}
          onUpdateEditIsRegex={setEditIsRegex}
          onUpdateEditPriority={setEditPriority}
          onCreatePattern={handleAddPattern}
          onUpdatePattern={handleEditPattern}
          onDeletePattern={handleDeletePattern}
        />

        {/* Edit Phase Priority Dialog */}
        <Dialog open={editPhaseOpen} onOpenChange={setEditPhaseOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Phase Priority</DialogTitle>
              <DialogDescription>
                Adjust the priority for this phase. Lower numbers = higher priority.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="phasePriority">Priority</Label>
                <Input
                  id="phasePriority"
                  type="number"
                  value={phasePriority}
                  onChange={(e) => setPhasePriority(Number(e.target.value))}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Lower numbers = higher priority
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditPhaseOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdatePhasePriority}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </main>
    </PageTransition>
  );
}
