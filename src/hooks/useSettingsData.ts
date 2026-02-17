import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BanWarningPattern, SettingsUpdate } from "@/lib/types";
import { getSettings, updateSettings, listActions, getDelayDefault, setDelayDefault, getDiagnosticsSnapshot } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { toastError } from "@/lib/toast-utils";

export function useSettingsData() {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const actionsQuery = useQuery({
    queryKey: ["actions"],
    queryFn: listActions,
  });

  const saveMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
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
  const [actionDelays, setActionDelays] = useState<Record<number, { min: number; max: number }>>({});

  useEffect(() => {
    const loadDelayDefaults = async () => {
      const delays: Record<number, { min: number; max: number }> = {};
      for (const action of actions) {
        try {
          const delayDefault = await getDelayDefault(action.id);
          delays[action.id] = {
            min: delayDefault?.min_seconds ?? 2,
            max: delayDefault?.max_seconds ?? 8,
          };
        } catch {
          delays[action.id] = { min: 2, max: 8 };
        }
      }
      setActionDelays(delays);
    };
    if (actions.length > 0) {
      loadDelayDefaults();
    }
  }, [actions]);

  return { actionDelays, setActionDelays };
}

export function useDiagnosticsSnapshot() {
  const diagnosticsQuery = useQuery({
    queryKey: ["diagnostics"],
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
      queryClient.invalidateQueries({ queryKey: ["delay-defaults"] });
    },
    onError: (error) => {
      toastError("Failed to update delay defaults", error);
    },
  });
  return mutation;
}

export function parseBanPatterns(json: string): BanWarningPattern[] {
  try {
    return JSON.parse(json) as BanWarningPattern[];
  } catch {
    return [];
  }
}

export function buildSettingsPayload(payload: SettingsUpdate) {
  return payload;
}
