import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BanWarningPattern } from "@/lib/types";
import { getSettings, updateSettings, listActions, getDelayDefault, setDelayDefault, getDiagnosticsSnapshot } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "@/components/ui/sonner";
import { toastError } from "@/lib/toast-utils";

export function useSettingsData() {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings(),
    queryFn: getSettings,
  });

  const actionsQuery = useQuery({
    queryKey: queryKeys.actions(),
    queryFn: listActions,
  });

  const saveMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
      toast.success("Settings saved", {
        description: "Your settings have been updated.",
      });
    },
    onError: (error) => {
      toastError("Failed to save settings", error);
    },
  });

  return { settingsQuery, actionsQuery, saveMutation };
}

export function useDelayDefaults(actions: { id: number }[]) {
  // Stable sorted key so query doesn't refetch when action order changes
  const stableKey = [...actions].map((a) => a.id).sort((a, b) => a - b).join(",");

  const query = useQuery({
    queryKey: queryKeys.delayDefaults(stableKey),
    queryFn: async () => {
      if (actions.length === 0) return {} as Record<number, { min: number; max: number }>;
      const results = await Promise.all(
        actions.map(async (action) => {
          try {
            const delayDefault = await getDelayDefault(action.id);
            return {
              id: action.id,
              min: delayDefault?.min_seconds ?? 2,
              max: delayDefault?.max_seconds ?? 8,
            };
          } catch {
            return { id: action.id, min: 2, max: 8 };
          }
        })
      );
      const delays: Record<number, { min: number; max: number }> = {};
      for (const r of results) {
        delays[r.id] = { min: r.min, max: r.max };
      }
      return delays;
    },
    enabled: actions.length > 0,
  });

  return { actionDelays: query.data ?? {}, isLoading: query.isLoading };
}

export function useDiagnosticsSnapshot() {
  const diagnosticsQuery = useQuery({
    queryKey: queryKeys.diagnostics(),
    queryFn: getDiagnosticsSnapshot,
  });

  return { diagnosticsQuery };
}

export function useDelayDefaultMutation() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ actionId, min, max }: { actionId: number; min: number; max: number }) =>
      setDelayDefault(actionId, min, max),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.delayDefaultsRoot() });
    },
    onError: (error) => {
      toastError("Failed to update delay defaults", error);
    },
  });
  return mutation;
}

export function parseBanPatterns(json: string): BanWarningPattern[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed as BanWarningPattern[];
  } catch {
    return [];
  }
}
