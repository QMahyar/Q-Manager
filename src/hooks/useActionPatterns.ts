import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ActionPattern } from "@/lib/types";
import { invokeCommand } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { getErrorMessage } from "@/lib/error-utils";
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
      toast.error("Failed to create pattern", { description: getErrorMessage(error) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateActionPattern,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["action-patterns", actionId] });
      toast.success("Pattern updated");
    },
    onError: (error) => {
      toast.error("Failed to update pattern", { description: getErrorMessage(error) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteActionPattern,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["action-patterns", actionId] });
      toast.success("Pattern deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete pattern", { description: getErrorMessage(error) });
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
  return useQuery({
    queryKey: ["action-pattern-counts", actionIds.join(",")],
    queryFn: async () => {
      const counts: Record<number, number> = {};
      for (const actionId of actionIds) {
        const patterns = await listActionPatterns(actionId);
        counts[actionId] = patterns.length;
      }
      return counts;
    },
    enabled: actionIds.length > 0,
  });
}
