import { useState } from "react";
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
} from "@tabler/icons-react";
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
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
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
import { HelpTooltip, helpContent } from "@/components/HelpTooltip";
import { RegexHelpDialog } from "@/components/RegexHelpDialog";
import { getErrorMessage } from "@/lib/error-utils";

export default function PhaseDetectionPage() {
  const queryClient = useQueryClient();
  const [selectedPhaseId, setSelectedPhaseId] = useState<number>(1);
  const [addPatternOpen, setAddPatternOpen] = useState(false);
  const [newPattern, setNewPattern] = useState("");
  const [isRegex, setIsRegex] = useState(false);
  const [priority, setPriority] = useState(0);
  const [deletePatternOpen, setDeletePatternOpen] = useState(false);
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
    onError: (e) => toast.error("Failed to delete pattern", { description: getErrorMessage(e) }),
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
    onError: (e) => toast.error("Failed to update pattern", { description: getErrorMessage(e) }),
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
          setDeletePatternOpen(false);
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
    onError: (e) => toast.error("Failed to update phase priority", { description: getErrorMessage(e) }),
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
      toast.error("Failed to reload patterns", { description: getErrorMessage(e) });
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
    <div className="min-h-screen flex flex-col">
      <PageHeader
        title="Phase Detection"
        description="Configure patterns to detect game phases"
      >
        <Button
          variant="outline"
          onClick={handleReloadPatterns}
          disabled={isReloading}
        >
          <IconRefresh className={`size-4 mr-2 ${isReloading ? "animate-spin" : ""}`} />
          Reload Patterns
        </Button>
      </PageHeader>
      <main className="flex-1 p-6 w-full max-w-6xl mx-auto">
        <Tabs
          value={String(selectedPhaseId)}
          onValueChange={(v) => setSelectedPhaseId(Number(v))}
        >
          <TabsList className="mb-4">
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
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{phase.display_name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {getPhaseDescription(phase.name)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Priority: {phase.priority}</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditPhasePriority(phase.priority)}
                      >
                        Edit Priority
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Patterns Header */}
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">
                    Patterns ({patterns.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const path = await saveDialog({
                          title: "Export phase patterns",
                          defaultPath: "phase-patterns.json",
                          filters: [{ name: "JSON", extensions: ["json"] }],
                        });
                        if (!path) return;
                        setIsExporting(true);
                        try {
                          await exportPhasePatterns(path as string);
                          toast.success("Phase patterns exported", {
                            description: "JSON file saved successfully.",
                          });
                        } catch (e) {
                          toast.error("Failed to export patterns", { description: getErrorMessage(e) });
                        } finally {
                          setIsExporting(false);
                        }
                      }}
                      disabled={isExporting}
                    >
                      <IconDownload className="size-4 mr-1" />
                      Export
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const path = await openDialog({
                          title: "Import phase patterns",
                          multiple: false,
                          filters: [{ name: "JSON", extensions: ["json"] }],
                        });
                        if (!path) return;
                        setIsImporting(true);
                        try {
                          const result = await importPhasePatterns(path as string);
                          toast.success("Phase patterns imported", {
                            description: `Imported ${result.imported}, Updated ${result.updated}.`,
                          });
                          queryClient.invalidateQueries({ queryKey: ["phase-patterns"] });
                          await reloadAllPatterns();
                        } catch (e) {
                          toast.error("Failed to import patterns", { description: getErrorMessage(e) });
                        } finally {
                          setIsImporting(false);
                        }
                      }}
                      disabled={isImporting}
                    >
                      <IconUpload className="size-4 mr-1" />
                      Import
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setAddPatternOpen(true)}
                    >
                      <IconPlus className="size-4 mr-1" />
                      Add Pattern
                    </Button>
                  </div>
                </div>

                {/* Patterns Table */}
                {patternsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading patterns...
                  </div>
                ) : patterns.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
                    No patterns configured for this phase.
                    <br />
                    Click "Add Pattern" to create one.
                  </div>
                ) : (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pattern</TableHead>
                          <TableHead className="w-24">Type</TableHead>
                          <TableHead className="w-24">Priority</TableHead>
                          <TableHead className="w-24">Enabled</TableHead>
                          <TableHead className="w-24 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody ref={patternsParent}>
                        {patterns
                          .sort((a, b) => b.priority - a.priority)
                          .map((pattern) => (
                            <TableRow key={pattern.id}>
                              <TableCell className="font-mono text-sm">
                                {pattern.pattern}
                              </TableCell>
                              <TableCell>
                                <Badge variant={pattern.is_regex ? "default" : "secondary"}>
                                  {pattern.is_regex ? "Regex" : "Text"}
                                </Badge>
                              </TableCell>
                              <TableCell>{pattern.priority}</TableCell>
                              <TableCell>
                                <Switch
                                  checked={pattern.enabled}
                                  onCheckedChange={() => handleTogglePattern(pattern)}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
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
                                    title="Edit pattern"
                                    aria-label="Edit pattern"
                                    onClick={() => openEditPattern(pattern)}
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
                                      setDeletePatternOpen(true);
                                    }}
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

        {/* Add Pattern Dialog */}
        <Dialog open={addPatternOpen} onOpenChange={setAddPatternOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Pattern</DialogTitle>
              <DialogDescription>
                Add a new detection pattern for this phase.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pattern">Pattern</Label>
                  <RegexValidationBadge pattern={newPattern} isRegex={isRegex} />
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
                    isRegex={isRegex}
                    onPatternChange={setNewPattern}
                    onIsRegexChange={setIsRegex}
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
                <Switch checked={isRegex} onCheckedChange={setIsRegex} />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="priority">Priority</Label>
                  <HelpTooltip content={helpContent.phasePriority} />
                </div>
                <Input
                  id="priority"
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  placeholder="0"
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
                disabled={!newPattern.trim() || (isRegex && (() => { try { new RegExp(newPattern); return false; } catch { return true; } })())}
              >
                Add Pattern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Pattern Dialog */}
        <Dialog open={deletePatternOpen} onOpenChange={setDeletePatternOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Pattern</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this pattern? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <code className="block bg-muted p-2 rounded text-sm">
                {patternToDelete?.pattern}
              </code>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeletePatternOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeletePattern} disabled={deletePatternMutation.isPending}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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

        {/* Edit Pattern Dialog */}
        <Dialog open={editPatternOpen} onOpenChange={setEditPatternOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Pattern</DialogTitle>
              <DialogDescription>
                Modify the detection pattern settings.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="editPattern">Pattern</Label>
                  <RegexValidationBadge pattern={editPattern} isRegex={editIsRegex} />
                </div>
                <div className="flex gap-2">
                  <Input
                    id="editPattern"
                    value={editPattern}
                    onChange={(e) => setEditPattern(e.target.value)}
                    placeholder="Enter pattern text or regex..."
                    className="font-mono flex-1"
                  />
                  <RegexTestDialog
                    pattern={editPattern}
                    isRegex={editIsRegex}
                    onPatternChange={setEditPattern}
                    onIsRegexChange={setEditIsRegex}
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
                <Switch checked={editIsRegex} onCheckedChange={setEditIsRegex} />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="editPriority">Priority</Label>
                  <HelpTooltip content={helpContent.phasePriority} />
                </div>
                <Input
                  id="editPriority"
                  type="number"
                  value={editPriority}
                  onChange={(e) => setEditPriority(Number(e.target.value))}
                  placeholder="0"
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
                disabled={!editPattern.trim() || (editIsRegex && (() => { try { new RegExp(editPattern); return false; } catch { return true; } })())}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
