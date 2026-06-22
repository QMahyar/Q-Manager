import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ActionPattern } from "@/lib/types";
import { invokeCommand } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { toastError } from "@/lib/toast-utils";
import { IPC_COMMANDS } from "@/lib/ipc";

export type ActionPatternCreate = {
  action_id: number;
  pattern: string;
  is_regex: boolean;
  enabled: boolean;
  priority: number;
  step: number;
};

export type ActionPatternUpdate = {
  id: number;
  pattern: string;
  is_regex: boolean;
  enabled: boolean;
  priority: number;
  step: number;
};

async function listActionPatterns(actionId: number): Promise<ActionPattern[]> {
  return invokeCommand(IPC_COMMANDS.actionPatternsList, { actionId });
}

async function createActionPattern(payload: ActionPatternCreate): Promise<ActionPattern> {
  return invokeCommand(IPC_COMMANDS.actionPatternCreate, { payload });
}

async function updateActionPattern(payload: ActionPatternUpdate): Promise<ActionPattern> {
  return invokeCommand(IPC_COMMANDS.actionPatternUpdate, { payload });
}

async function deleteActionPattern(patternId: number): Promise<void> {
  return invokeCommand(IPC_COMMANDS.actionPatternDelete, { patternId });
}

export function useActionPatterns(actionId: number | null) {
  const queryClient = useQueryClient();

  const patternsQuery = useQuery({
    queryKey: ["action-patterns", actionId],
    queryFn: () => listActionPatterns(actionId ?? 0),
    enabled: actionId !== null,
  });

  const createMutation = useMutation({
    mutationFn: createActionPattern,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["action-patterns", variables.action_id] });
      toast.success("Pattern created");
    },
    onError: (error) => {
      toastError("Failed to create pattern", error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateActionPattern,
    onSuccess: (data) => {
      // Use the returned pattern's action_id — not the potentially-stale closure value
      queryClient.invalidateQueries({ queryKey: ["action-patterns", data.action_id] });
      toast.success("Pattern updated");
    },
    onError: (error) => {
      toastError("Failed to update pattern", error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ patternId }: { patternId: number; actionId: number }) =>
      deleteActionPattern(patternId),
    onSuccess: (_, variables) => {
      // Use variables.actionId so we don't capture a stale closure value
      queryClient.invalidateQueries({ queryKey: ["action-patterns", variables.actionId] });
      toast.success("Pattern deleted");
    },
    onError: (error) => {
      toastError("Failed to delete pattern", error);
    },
  });

  return {
    patternsQuery,
    createMutation,
    updateMutation,
    deleteMutation,
  };
}

export function useActionPatternCounts(actionIds: number[]) {
  // Sort IDs for a stable query key regardless of input order
  const stableKey = [...actionIds].sort((a, b) => a - b).join(",");
  return useQuery({
    queryKey: ["action-pattern-counts", stableKey],
    queryFn: async () => {
      // Fetch all pattern lists in parallel instead of sequentially
      const results = await Promise.all(actionIds.map((id) => listActionPatterns(id)));
      const counts: Record<number, number> = {};
      actionIds.forEach((id, i) => { counts[id] = results[i].length; });
      return counts;
    },
    enabled: actionIds.length > 0,
  });
}
